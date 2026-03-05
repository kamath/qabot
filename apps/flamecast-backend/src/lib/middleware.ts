import type {
	AuthEnv as _AuthEnv,
	WorkspaceEnv as _WorkspaceEnv,
} from "@flamecast/auth"
import { createAuthMiddleware } from "@flamecast/auth"
import type { Bindings } from "../index"
import { createDbFromUrl } from "./db"
import { authenticateBearer } from "./auth"

export const authMiddleware = createAuthMiddleware({
	createDbFromUrl,
	authenticateBearer,
})

export { sessionMiddleware, workspaceMiddleware } from "@flamecast/auth"

export type AuthEnv = _AuthEnv<Bindings>
export type WorkspaceEnv = _WorkspaceEnv<Bindings>
