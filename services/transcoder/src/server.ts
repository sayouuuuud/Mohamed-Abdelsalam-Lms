'use strict'
/**
 * server.ts — نقطة الدخول الرئيسية للوركر
 *
 * بيشغّل HTTP server صغير على PORT (افتراضي 4000) بغض النظر عن الوضع.
 * ده بيسمح لـ Railway / Fly.io بمراقبة الصحة (health check) والـ scale-to-zero.
 *
 * Routes:
 *   GET  /health  → { ok: true, mode, uptime }
 *   POST /wake    → يُفعّل processOneJob() (وضع http scale-to-zero)
 *
 * الأمان:
 *   - POST /wake يتحقق من WORKER_WAKE_SECRET في header Authorization
 *   - لو WORKER_MODE=poll، الـ /wake لا تزال تعمل (manual trigger)
 */

import http from 'http'
import { processOneJob, runLoop } from './worker'

const PORT  = parseInt(process.env.PORT ?? '4000')
const MODE  = (process.env.WORKER_MODE ?? 'http').toLowerCase()   // 'http' | 'poll'
const SECRET = process.env.WORKER_WAKE_SECRET ?? ''

const server = http.createServer(async (req, res) => {
  // ---------------------------------------------------------------
  // GET /health — دايماً متاح بدون مصادقة
  // ---------------------------------------------------------------
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, mode: MODE, uptime: process.uptime() }))
    return
  }

  // ---------------------------------------------------------------
  // POST /wake — تحقق من السر أولاً
  // ---------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/wake') {
    const auth = req.headers['authorization'] ?? ''
    if (SECRET && auth !== `Bearer ${SECRET}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'unauthorized' }))
      return
    }

    res.writeHead(202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ queued: true }))

    // نفّذ في الخلفية بعد إغلاق الـ response
    setImmediate(async () => {
      try {
        await processOneJob()
      } catch (err) {
        console.error('[server] /wake processOneJob error:', err)
      }
    })
    return
  }

  // ---------------------------------------------------------------
  // أي route تاني → 404
  // ---------------------------------------------------------------
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found' }))
})

server.listen(PORT, () => {
  console.log(`[transcoder] HTTP server listening on :${PORT}`)
  console.log(`[transcoder] mode: ${MODE}`)

  // لو وضع polling، ابدأ الـ loop بعد ما السيرفر يرفع
  if (MODE === 'poll') {
    runLoop().catch((err) => {
      console.error('[transcoder] runLoop crashed:', err)
      process.exit(1)
    })
  }
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[transcoder] SIGTERM — جاري الإغلاق ...')
  server.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('[transcoder] SIGINT — جاري الإغلاق ...')
  server.close(() => process.exit(0))
})
