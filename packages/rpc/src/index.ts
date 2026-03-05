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

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object'
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
  const payload = await c.req.json().catch(() => ({}))

  const message =
    isRecord(payload) &&
    typeof payload.message === 'string' &&
    payload.message.trim().length > 0
      ? payload.message
      : 'hello from backend'

  return c.json<EchoResponse>({
    received: message,
  })
})

export type AppType = typeof app
export type BackendClient = {
  ping: {
    $get: () => Promise<Response>
  }
  echo: {
    $post: (options: { json: EchoRequest }) => Promise<Response>
  }
}

export const isBackendGreetingResponse = (
  value: unknown,
): value is BackendGreetingResponse => {
  return (
    isRecord(value) &&
    typeof value.service === 'string' &&
    typeof value.status === 'string' &&
    typeof value.time === 'string'
  )
}

export const isEchoResponse = (value: unknown): value is EchoResponse => {
  return isRecord(value) && typeof value.received === 'string'
}

export const createBackendClient = (baseUrl: string): BackendClient => {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  return {
    ping: {
      $get: async () => {
        return await fetch(`${trimmed}/ping`)
      },
    },
    echo: {
      $post: async ({ json }) => {
        return await fetch(`${trimmed}/echo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(json),
        })
      },
    },
  }
}

export default app
