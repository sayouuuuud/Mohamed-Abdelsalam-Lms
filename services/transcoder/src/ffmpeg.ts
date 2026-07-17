'use strict'
/**
 * ffmpeg.ts
 * ينفّذ FFmpeg عبر child_process.spawn — لا wrapper خارجي.
 * المخرج: HLS ladder بجودة أصلية واحدة (Single Rendition) بناءً على طلب العميل.
 */

import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs/promises'

// ---------------------------------------------------------------
// transcode: المدخل ← ملف فيديو محلي. المخرج ← مجلد HLS.
// ---------------------------------------------------------------
export async function transcode(opts: {
  inputPath:   string
  outputDir:   string
  renditions?: string[]          // مُهمل حالياً
  threads:     number            // 0 = auto
  segmentDurationSec?: number    // مدة المقطع بالثواني
  onProgress?: (pct: number) => void
}): Promise<{ durationSeconds: number }> {
  const { inputPath, outputDir, threads, segmentDurationSec = 10, onProgress } = opts

  // تأكد من وجود المجلد
  await fs.mkdir(outputDir, { recursive: true })
  
  const segDir = path.join(outputDir, 'original')
  await fs.mkdir(segDir, { recursive: true })

  // احسب مدة الفيديو الأصلي أولاً (لتتبع التقدّم)
  const totalSeconds = await probeDuration(inputPath)

  // ابنِ أوامر FFmpeg
  const args = buildFfmpegArgs({ inputPath, outputDir, threads, segmentDurationSec })

  console.log('[ffmpeg] starting transcoding: Original Quality Only')
  console.log('[ffmpeg] args:', args.join(' '))

  await runFfmpeg(args, totalSeconds, onProgress)

  // ولّد master.m3u8
  await writeMasterManifest(outputDir)

  return { durationSeconds: totalSeconds }
}

// ---------------------------------------------------------------
// buildFfmpegArgs: يبني مصفوفة الأوامر
// ---------------------------------------------------------------
function buildFfmpegArgs(opts: {
  inputPath: string
  outputDir: string
  threads:   number
  segmentDurationSec: number
}): string[] {
  const { inputPath, outputDir, threads, segmentDurationSec } = opts
  const args: string[] = []

  // إعدادات عامة
  args.push('-hide_banner', '-loglevel', 'warning', '-stats')
  if (threads > 0) args.push('-threads', String(threads))

  // المدخل
  args.push('-i', inputPath)

  const segDir = path.join(outputDir, 'original')

  // إعدادات الفيديو والصوت وجودة واحدة فقط
  args.push(
    '-c:v', 'libx264',
    '-preset:v', 'veryfast',
    '-crf:v', '23',                 // جودة ممتازة مقاربة للأصل بضغط ذكي
    '-profile:v', 'main',
    '-level:v', '4.1',
    '-sc_threshold:v', '0',
    '-g:v', '48',
    '-keyint_min:v', '48',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar:a', '44100',
    '-ac:a', '2',
    '-f', 'hls',
    '-hls_time', String(segmentDurationSec),
    '-hls_playlist_type', 'vod',
    '-hls_segment_type', 'mpegts',
    '-hls_segment_filename', path.join(segDir, 'seg%05d.ts'),
    '-hls_flags', 'independent_segments',
    path.join(segDir, 'index.m3u8')
  )

  return args
}

// ---------------------------------------------------------------
// runFfmpeg: ينفّذ العملية مع progress tracking
// ---------------------------------------------------------------
async function runFfmpeg(args: string[], totalSeconds: number, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })

    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer) => {
      const line = chunk.toString()
      stderr += line

      // parse time=HH:MM:SS.ss من تقرير FFmpeg
      if (onProgress && totalSeconds > 0) {
        const m = line.match(/time=(\d+):(\d+):(\d+\.\d+)/)
        if (m) {
          const secs = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])
          onProgress(Math.min(99, (secs / totalSeconds) * 100))
        }
      }
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`[ffmpeg] خرج بكود ${code}\n${stderr.slice(-1000)}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`[ffmpeg] فشل في تشغيل FFmpeg: ${err.message}. تأكد من تثبيته.`))
    })
  })
}

// ---------------------------------------------------------------
// writeMasterManifest: يكتب master.m3u8
// ---------------------------------------------------------------
async function writeMasterManifest(outputDir: string): Promise<void> {
  const lines: string[] = [
    '#EXTM3U', 
    '#EXT-X-VERSION:3', 
    '',
    `#EXT-X-STREAM-INF:BANDWIDTH=3000000,NAME="Original"`,
    `original/index.m3u8`,
    ''
  ]

  await fs.writeFile(path.join(outputDir, 'master.m3u8'), lines.join('\n'), 'utf8')
  console.log('[ffmpeg] master.m3u8 written')
}

// ---------------------------------------------------------------
// probeDuration: يستخدم ffprobe للحصول على مدة الفيديو
// ---------------------------------------------------------------
async function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      filePath,
    ], { stdio: ['ignore', 'pipe', 'ignore'] })

    let out = ''
    proc.stdout.on('data', (d: Buffer) => { out += d.toString() })
    proc.on('close', () => {
      try {
        const json = JSON.parse(out)
        const dur = parseFloat(json.format?.duration ?? '0')
        if (isNaN(dur) || dur <= 0) {
          reject(new Error(`[ffmpeg] فشل في قراءة مدة الفيديو بشكل صحيح. القيمة المستلمة: ${json.format?.duration}`))
        } else {
          resolve(dur)
        }
      } catch (err) {
        reject(new Error('[ffmpeg] فشل في تحليل مخرجات ffprobe'))
      }
    })
    proc.on('error', (err) => reject(new Error(`[ffmpeg] ffprobe فشل في العمل: ${err.message}`)))
  })
}
