/**
 * db.ts
 * طبقة الاتصال بـ Supabase من داخل الوركر.
 * بيستخدم SUPABASE_URL + SUPABASE_SERVICE_KEY (service_role) مباشرة —
 * لا يمر عبر RLS — ده مقصود عشان الوركر يكون خارج دائرة الـ auth.
 */
import { SupabaseClient } from '@supabase/supabase-js';
export declare function getDb(): SupabaseClient;
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