import { Hono } from 'hono'
import { cors } from 'hono/cors'

export type BackendGreetingResponse = {
  service: string
  status: string
  time: string
}

type EchoRequest = {
  message: string
}

type EchoResponse = {
  received: string
}

const app = new Hono()

app.use('*', cors())

app.get('/ping', (c) => {
  return c.json<BackendGreetingResponse>({
    service: 'backend',
    status: 'ok',
    time: new Date().toISOString(),
  })
})

app.post('/echo', async (c) => {
  const payload = (await c.req.json().catch(() => ({}))) as Partial<EchoRequest>

  const message =
    typeof payload.message === 'string' && payload.message.trim().length > 0
      ? payload.message
      : 'hello from backend'

  return c.json<EchoResponse>({
    received: message,
  })
})

export type AppType = typeof app

export default app
