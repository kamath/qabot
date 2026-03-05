import { hc } from 'hono/client'
import type { AppType } from '@qabot/rpc'

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:6969'

export const backendClient = hc<AppType>(`${backendUrl}/`)
