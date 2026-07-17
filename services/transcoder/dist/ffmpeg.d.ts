export declare function transcode(opts: {
    inputPath: string;
    outputDir: string;
    renditions?: string[];
    threads: number;
    segmentDurationSec?: number;
    onProgress?: (pct: number) => void;
}): Promise<{
    durationSeconds: number;
}>;
//# sourceMappingURL=ffmpeg.d.ts.map