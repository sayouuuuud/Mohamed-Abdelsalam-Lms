'use strict';
/**
 * ffmpeg.ts
 * ينفّذ FFmpeg عبر child_process.spawn — لا wrapper خارجي.
 * المخرج: HLS ladder متعدد الجودات + master manifest.
 *
 * RENDITIONS المتاحة: 360p | 480p | 720p | 1080p
 * الـ admin panel بيحدد أيها تُنتَج (renditions[] من streaming_settings).
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
const ALL_RENDITIONS = {
    '360p': { name: '360p', height: 360, videoBitrate: '800k', audioBitrate: '96k', maxRate: '856k', bufSize: '1200k' },
    '480p': { name: '480p', height: 480, videoBitrate: '1400k', audioBitrate: '128k', maxRate: '1498k', bufSize: '2100k' },
    '720p': { name: '720p', height: 720, videoBitrate: '2800k', audioBitrate: '128k', maxRate: '2996k', bufSize: '4200k' },
    '1080p': { name: '1080p', height: 1080, videoBitrate: '5000k', audioBitrate: '192k', maxRate: '5350k', bufSize: '7500k' },
};
// ---------------------------------------------------------------
// transcode: المدخل ← ملف فيديو محلي. المخرج ← مجلد HLS كامل.
// يستدعي FFmpeg مرة واحدة لكل الجودات (multi-output أكثر كفاءة).
// ---------------------------------------------------------------
export async function transcode(opts) {
    const { inputPath, outputDir, renditions, threads, onProgress } = opts;
    // تأكد من وجود المجلد
    await fs.mkdir(outputDir, { recursive: true });
    // صفّي الـ renditions المطلوبة
    const active = renditions
        .filter((r) => ALL_RENDITIONS[r])
        .map((r) => ALL_RENDITIONS[r]);
    if (active.length === 0)
        throw new Error('[ffmpeg] لا توجد renditions صحيحة');
    // احسب مدة الفيديو الأصلي أولاً (لتتبع التقدّم)
    const totalSeconds = await probeDuration(inputPath);
    // ابنِ أوامر FFmpeg
    const args = buildFfmpegArgs({ inputPath, outputDir, active, threads });
    console.log('[ffmpeg] starting transcoding:', renditions.join(', '));
    console.log('[ffmpeg] args:', args.join(' '));
    await runFfmpeg(args, totalSeconds, onProgress);
    // ولّد master.m3u8 يجمع كل الجودات
    await writeMasterManifest(outputDir, active);
    return { durationSeconds: totalSeconds };
}
// ---------------------------------------------------------------
// buildFfmpegArgs: يبني مصفوفة الأوامر لـ multi-output HLS
// ---------------------------------------------------------------
function buildFfmpegArgs(opts) {
    const { inputPath, outputDir, active, threads } = opts;
    const args = [];
    // إعدادات عامة
    args.push('-hide_banner', '-loglevel', 'warning', '-stats');
    if (threads > 0)
        args.push('-threads', String(threads));
    // المدخل
    args.push('-i', inputPath);
    // فلتر التحجيم — scale يحافظ على النسبة مع force إجبار العرض زوجي
    const filterChain = active
        .map((r, i) => `[0:v]scale=-2:${r.height}[v${i}]`)
        .join(';');
    args.push('-filter_complex', filterChain);
    // لكل rendition: تشفير فيديو + صوت + HLS output
    active.forEach((r, i) => {
        const segDir = path.join(outputDir, r.name);
        // map الـ stream
        args.push('-map', `[v${i}]`, '-map', '0:a');
        // إعدادات الفيديو
        args.push(`-c:v:${i}`, 'libx264', `-preset:v:${i}`, 'veryfast', // سرعة + جودة مقبولة
        `-crf:v:${i}`, '23', `-b:v:${i}`, r.videoBitrate, `-maxrate:v:${i}`, r.maxRate, `-bufsize:v:${i}`, r.bufSize, `-profile:v:${i}`, 'main', // توافق iOS/Android
        `-level:v:${i}`, '4.1', `-sc_threshold:v:${i}`, '0', // يمنع keyframes عشوائية
        `-g:v:${i}`, '48', // GOP = 2 ثانية عند 24fps
        `-keyint_min:v:${i}`, '48');
        // إعدادات الصوت
        args.push(`-c:a:${i}`, 'aac', `-b:a:${i}`, r.audioBitrate, `-ar:a:${i}`, '44100', `-ac:a:${i}`, '2');
        // HLS output
        args.push(`-f:${i}`, 'hls', `-hls_time:${i}`, '4', // مدة كل segment: 4 ثواني
        `-hls_playlist_type:${i}`, 'vod', `-hls_segment_type:${i}`, 'mpegts', `-hls_segment_filename:${i}`, path.join(segDir, 'seg%05d.ts'), `-hls_flags:${i}`, 'independent_segments', path.join(segDir, 'index.m3u8'));
    });
    return args;
}
// ---------------------------------------------------------------
// runFfmpeg: ينفّذ FFmpeg ويتابع التقدّم عبر stderr
// ---------------------------------------------------------------
function runFfmpeg(args, totalSeconds, onProgress) {
    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        proc.stderr.on('data', (chunk) => {
            const line = chunk.toString();
            stderr += line;
            // parse time=HH:MM:SS.ss من تقرير FFmpeg
            if (onProgress && totalSeconds > 0) {
                const m = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
                if (m) {
                    const secs = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
                    onProgress(Math.min(99, (secs / totalSeconds) * 100));
                }
            }
        });
        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`[ffmpeg] خرج بكود ${code}\n${stderr.slice(-1000)}`));
            }
        });
        proc.on('error', (err) => {
            reject(new Error(`[ffmpeg] فشل في تشغيل FFmpeg: ${err.message}. تأكد من تثبيته.`));
        });
    });
}
// ---------------------------------------------------------------
// writeMasterManifest: يكتب master.m3u8 يجمع كل الجودات
// ---------------------------------------------------------------
async function writeMasterManifest(outputDir, active) {
    const lines = ['#EXTM3U', '#EXT-X-VERSION:3', ''];
    for (const r of active) {
        const approxBw = parseInt(r.videoBitrate) * 1000 + parseInt(r.audioBitrate) * 1000;
        lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${approxBw},RESOLUTION=${getResWidth(r.height)}x${r.height},NAME="${r.name}"`, `${r.name}/index.m3u8`, '');
    }
    await fs.writeFile(path.join(outputDir, 'master.m3u8'), lines.join('\n'), 'utf8');
    console.log('[ffmpeg] master.m3u8 written');
}
// ---------------------------------------------------------------
// probeDuration: يستخدم ffprobe للحصول على مدة الفيديو
// ---------------------------------------------------------------
async function probeDuration(filePath) {
    return new Promise((resolve) => {
        const proc = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            filePath,
        ], { stdio: ['ignore', 'pipe', 'ignore'] });
        let out = '';
        proc.stdout.on('data', (d) => { out += d.toString(); });
        proc.on('close', () => {
            try {
                const json = JSON.parse(out);
                resolve(parseFloat(json.format?.duration ?? '0'));
            }
            catch {
                resolve(0);
            }
        });
        proc.on('error', () => resolve(0));
    });
}
// helper: عرض الفيديو لكل ارتفاع (نسبة 16:9 تقريبية)
function getResWidth(height) {
    const map = { 360: 640, 480: 854, 720: 1280, 1080: 1920 };
    return map[height] ?? Math.round(height * 16 / 9);
}
//# sourceMappingURL=ffmpeg.js.map