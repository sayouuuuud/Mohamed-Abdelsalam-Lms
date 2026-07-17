import pg from 'pg';
export declare function getDbPool(): pg.Pool;
export declare function claimNextJob(): Promise<{
    jobId: string;
    videoId: string;
    r2RawKey: string;
    threadsOverride: number | null;
} | null>;
export declare function updateJobProgress(jobId: string, _progress: number): Promise<void>;
export declare function markVideoReady(jobId: string, videoId: string, hlsPrefix: string, durationSeconds: number): Promise<void>;
export declare function markVideoFailed(jobId: string, videoId: string, errorMsg: string): Promise<void>;
export declare function getStreamingConfig(): Promise<{
    isStreamingEnabled: boolean;
    maxConcurrentJobs: number;
    ffmpegThreads: number;
    renditions: any[];
    segmentDurationSec: number;
} | null>;
//# sourceMappingURL=db.d.ts.map