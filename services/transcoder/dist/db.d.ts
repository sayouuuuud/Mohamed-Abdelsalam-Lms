/**
 * db.ts
 * طبقة الاتصال بقاعدة بيانات PostgreSQL مباشرة من داخل الوركر.
 * بيستخدم DATABASE_URL — لا يمر عبر Prisma عشان يكون خفيف ومستقل.
 */
import pg from 'pg';
export declare function getDbPool(): pg.Pool;
export declare function claimNextJob(): Promise<{
    jobId: string;
    videoId: string;
    r2RawKey: string;
    threadsOverride: number | null;
} | null>;
export declare function updateJobProgress(jobId: string, progress: number): Promise<void>;
export declare function markVideoReady(jobId: string, videoId: string, hlsPrefix: string, durationSeconds: number): Promise<void>;
export declare function markVideoFailed(jobId: string, videoId: string, errorMsg: string): Promise<void>;
export declare function getStreamingConfig(): Promise<{
    maxConcurrentJobs: number;
    ffmpegThreads: number;
    renditions: string[];
} | null>;
//# sourceMappingURL=db.d.ts.map