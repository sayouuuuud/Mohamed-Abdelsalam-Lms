'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Maximize,
  Pause,
  Play,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SPEEDS = [0.5, 1, 1.5, 2] as const

// ---------------------------------------------------------------
// Hook: يُحمّل hls.js ويوصّله بعنصر <video> لو src هو HLS manifest
// بيرجع null للـ MP4 القديم (يعمل بـ <source> عادي)
// ---------------------------------------------------------------
function useHls(
  src: string | undefined,
  videoEl: React.RefObject<HTMLVideoElement | null>,
  retryKey: number,
  onFatalError: () => void,
) {
  const hlsRef = useRef<import('hls.js').default | null>(null)
  const isHls = !!src && (src.includes('/api/hls/') || src.endsWith('.m3u8'))

  useEffect(() => {
    const video = videoEl.current
    if (!video || !src) return

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    if (!isHls) return

    // Safari supports HLS natively; assigning again also performs a full retry.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      video.load()
      return
    }

    let cancelled = false
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !videoEl.current) return
      if (!Hls.isSupported()) {
        onFatalError()
        return
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1,
      })
      let recoveredNetwork = false
      let recoveredMedia = false

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !recoveredNetwork) {
          recoveredNetwork = true
          hls.startLoad()
          return
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recoveredMedia) {
          recoveredMedia = true
          hls.recoverMediaError()
          return
        }
        hls.destroy()
        if (hlsRef.current === hls) hlsRef.current = null
        onFatalError()
      })

      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(videoEl.current)
    })

    return () => {
      cancelled = true
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [src, isHls, retryKey, videoEl, onFatalError])

  return { isHls }
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VideoPlayer({
  src,
  poster,
  className,
}: {
  src?: string
  poster?: string
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState<number>(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const onFatalHlsError = useCallback(() => setError(true), [])
  const { isHls } = useHls(src, videoRef, retryKey, onFatalHlsError)

  const isYoutube = src && (src.includes('youtube.com/') || src.includes('youtu.be/'))
  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
    const match = url.match(regExp)
    return match && match[2].length === 11 ? match[2] : null
  }

  // Reset state when video source changes.
  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
    setError(false)
  }, [src])

  // مزامنة سرعة التشغيل مع عنصر الفيديو
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed
  }, [speed])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play()
    } else {
      v.pause()
    }
  }

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current
    if (!v) return
    const time = (Number(e.target.value) / 100) * (v.duration || 0)
    v.currentTime = time
    setCurrent(time)
  }

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void el.requestFullscreen()
    }
  }

  const progress = duration ? (current / duration) * 100 : 0

  if (isYoutube) {
    const yid = getYoutubeId(src!)
    if (yid) {
      return (
        <div className={cn('relative size-full bg-black', className)} dir="ltr">
          <iframe
            className="absolute inset-0 size-full border-0"
            src={`https://www.youtube.com/embed/${yid}?rel=0&modestbranding=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn('group relative size-full bg-black', className)}
      dir="ltr"
    >
      <video
        ref={videoRef}
        poster={poster}
        className="absolute inset-0 size-full object-contain"
        preload="metadata"
        crossOrigin="anonymous"
        controlsList="nodownload noremoteplayback nofullscreen"
        disablePictureInPicture
        disableRemotePlayback
        onContextMenu={(e) => e.preventDefault()}
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (Number.isFinite(d) && d > 0) setDuration(d)
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration
          if (Number.isFinite(d) && d > 0) setDuration(d)
        }}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        onError={() => setError(true)}
      >
        {/* HLS: src يُعيَّن بواسطة useHls hook — لا نضع <source> هنا */}
        {src && !isHls ? <source src={src} type="video/mp4" /> : null}
        متصفحك لا يدعم تشغيل الفيديو.
      </video>

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 text-white">
          <p className="text-sm font-medium">تعذّر تحميل الفيديو</p>
          <button
            type="button"
            onClick={() => {
              setError(false)
              // Bump retryKey to force useHls to re-initialise hls.js from scratch;
              // also reload the native <video> for plain MP4 sources.
              setRetryKey((k) => k + 1)
              const v = videoRef.current
              if (v && !isHls) v.load()
            }}
            className="rounded-lg bg-white/15 px-4 py-2 text-sm transition-colors hover:bg-white/25"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Settings menu */}
      {settingsOpen && (
        <div className="absolute bottom-20 right-4 z-20 w-44 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/95 p-2 text-white shadow-2xl backdrop-blur">
          <p className="px-2 pb-1 pt-1 text-xs font-medium text-white/60">Speed</p>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={cn(
                'mb-1 w-full rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors',
                speed === s
                  ? 'bg-white text-neutral-900'
                  : 'text-white hover:bg-white/10',
              )}
            >
              {s}x
            </button>
          ))}

        </div>
      )}

      {/* Center play overlay */}
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="تشغيل"
          className="absolute inset-0 z-10 flex items-center justify-center"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-transform hover:scale-105">
            <Play className="size-7 translate-x-0.5 fill-white" />
          </span>
        </button>
      )}

      {/* Controls bar */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8">
        {/* Progress */}
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={progress}
          onChange={onSeek}
          aria-label="شريط التقدم"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/30 accent-white [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
          style={{
            background: `linear-gradient(to right, #fff ${progress}%, rgba(255,255,255,0.3) ${progress}%)`,
          }}
        />

        <div className="flex items-center gap-3 text-white">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
            className="flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-white/15"
          >
            {playing ? (
              <Pause className="size-5 fill-white" />
            ) : (
              <Play className="size-5 translate-x-0.5 fill-white" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            className="flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-white/15"
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>

          <span className="text-sm tabular-nums text-white/90">
            {formatTime(current)} / {formatTime(duration)}
          </span>

          <div className="ms-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-label="الإعدادات"
              className={cn(
                'flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-white/15',
                settingsOpen && 'bg-white/15',
              )}
            >
              <Settings className="size-5" />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="ملء الشاشة"
              className="flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-white/15"
            >
              <Maximize className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
