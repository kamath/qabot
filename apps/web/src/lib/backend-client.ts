import { createBackendClient } from '@qabot/rpc'

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:6969'

export const backendClient = createBackendClient(backendUrl)
