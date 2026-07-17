'use strict';
/**
 * db.ts
 * طبقة الاتصال بقاعدة بيانات PostgreSQL مباشرة من داخل الوركر.
 * بيستخدم DATABASE_URL — لا يمر عبر Prisma عشان يكون خفيف ومستقل.
 */
import pg from 'pg';
const { Pool } = pg;
let _pool = null;
export function getDbPool() {
    if (_pool)
        return _pool;
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error('[transcoder] DATABASE_URL غير موجود في .env');
    }
    _pool = new Pool({
        connectionString: url,
        max: 10, // Max 10 connections for the worker
    });
    return _pool;
}
// ---------------------------------------------------------------
// claim: يحجز job واحد بشكل آمن (لا race condition مع replicas متعددة)
// بيستخدم دالة claim_next_video_job() الـ SQL اللي اتعرّفت في M1
// ---------------------------------------------------------------
export async function claimNextJob() {
    const pool = getDbPool();
    try {
        const { rows } = await pool.query('SELECT * FROM claim_next_video_job()');
        if (!rows || rows.length === 0)
            return null;
        const row = rows[0];
        return {
            jobId: row.job_id,
            videoId: row.video_id,
            r2RawKey: row.r2_raw_key,
            threadsOverride: row.threads_override ?? null,
        };
    }
    catch (error) {
        console.error('[transcoder] claimNextJob error:', error.message);
        return null;
    }
}
// تحديث حالة الـ job أثناء المعالجة
export async function updateJobProgress(jobId, progress) {
    const pool = getDbPool();
    try {
        await pool.query(`UPDATE video_jobs SET progress = $1, updated_at = NOW() WHERE id = $2`, [Math.round(progress), jobId]);
    }
    catch (error) {
        console.error('[transcoder] updateJobProgress error:', error.message);
    }
}
// تحديث حالة الـ video و job عند الانتهاء
export async function markVideoReady(jobId, videoId, hlsPrefix, durationSeconds) {
    const pool = getDbPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE videos 
       SET status = 'ready', r2_hls_prefix = $1, duration_sec = $2, updated_at = NOW() 
       WHERE id = $3`, [hlsPrefix, durationSeconds, videoId]);
        await client.query(`UPDATE video_jobs 
       SET status = 'done', progress = 100, finished_at = NOW(), updated_at = NOW() 
       WHERE id = $1`, [jobId]);
        await client.query('COMMIT');
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('[transcoder] markVideoReady error:', error.message);
        throw error;
    }
    finally {
        client.release();
    }
}
// تسجيل فشل
export async function markVideoFailed(jobId, videoId, errorMsg) {
    const pool = getDbPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE videos SET status = 'error', updated_at = NOW() WHERE id = $1`, [videoId]);
        await client.query(`UPDATE video_jobs 
       SET status = 'error', error_message = $1, finished_at = NOW(), updated_at = NOW() 
       WHERE id = $2`, [errorMsg, jobId]);
        await client.query('COMMIT');
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('[transcoder] markVideoFailed error:', error.message);
    }
    finally {
        client.release();
    }
}
// جلب إعدادات الـ streaming من platform_settings
export async function getStreamingConfig() {
    const pool = getDbPool();
    try {
        const { rows } = await pool.query(`SELECT worker_concurrency, worker_cpu_threads FROM platform_settings WHERE id = 1 LIMIT 1`);
        if (!rows || rows.length === 0)
            return null;
        const data = rows[0];
        return {
            maxConcurrentJobs: data.worker_concurrency ?? 1,
            ffmpegThreads: data.worker_cpu_threads ?? 2,
            renditions: ['360p', '480p', '720p'], // افتراضي
        };
    }
    catch (error) {
        console.error('[transcoder] getStreamingConfig error:', error.message);
        return null;
    }
}
//# sourceMappingURL=db.js.map