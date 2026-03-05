#!/usr/bin/env bun

import app from '../src/index'

const port = Number(process.env.PORT) || 6969

const server = Bun.serve({
  fetch: app.fetch,
  port,
})

if (typeof process !== 'undefined') {
  const close = () => {
    server.stop()
  }

  process.on('SIGINT', close)
  process.on('SIGTERM', close)
}

console.log(`\n🚀 Backend server running on http://localhost:${port}`)
