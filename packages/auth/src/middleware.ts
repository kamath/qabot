import { createMiddleware } from "hono/factory"
import { getCookie, setCookie } from "hono/cookie"
import { eq } from "drizzle-orm"
import { WorkOS } from "@workos-inc/node"
import {
	workspaces as workspacesTable,
	userOrganizations as userOrganizationsTable,
} from "@flamecast/db/schema"
import type { BaseBindings } from "./types.js"
import { createDbFromUrl } from "./db.js"
import { authenticateBearer } from "./auth.js"

export type AuthEnv<T extends BaseBindings = BaseBindings> = {
	Bindings: T
	Variables: {
		db: ReturnType<typeof createDbFromUrl>
		workos: WorkOS
		authRow: { userId: string }
	}
}

export type WorkspaceEnv<T extends BaseBindings = BaseBindings> = {
	Bindings: T
	Variables: AuthEnv<T>["Variables"] & {
		workspace: typeof workspacesTable.$inferSelect
	}
}

export type AuthMiddlewareDeps = {
	createDbFromUrl: typeof createDbFromUrl
	authenticateBearer: typeof authenticateBearer
}

export function createAuthMiddleware(deps: AuthMiddlewareDeps) {
	return createMiddleware<AuthEnv>(async (c, next) => {
		const db = deps.createDbFromUrl(c.env.HYPERDRIVE.connectionString)
		const workos = new WorkOS(c.env.WORKOS_API_KEY, {
			clientId: c.env.WORKOS_CLIENT_ID,
		})
		const authRow = await deps.authenticateBearer(
			db,
			c.req.header("authorization"),
			workos,
		)
		if (!authRow) return c.json({ error: "Unauthorized" }, 401)

		c.set("db", db)
		c.set("workos", workos)
		c.set("authRow", authRow)
		await next()
	})
}

export const authMiddleware = createAuthMiddleware({
	createDbFromUrl,
	authenticateBearer,
})

export const sessionMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
	const db = createDbFromUrl(c.env.HYPERDRIVE.connectionString)
	const workos = new WorkOS(c.env.WORKOS_API_KEY, {
		clientId: c.env.WORKOS_CLIENT_ID,
	})

	const sessionData = getCookie(c, "wos-session") ?? ""
	if (!sessionData) {
		return c.json({ error: "Unauthorized" }, 401)
	}

	const session = workos.userManagement.loadSealedSession({
		sessionData,
		cookiePassword: c.env.WORKOS_COOKIE_PASSWORD,
	})

	const authResult = await session.authenticate()

	if (authResult.authenticated) {
		c.set("db", db)
		c.set("workos", workos)
		c.set("authRow", { userId: authResult.user.id })
		return next()
	}

	// Session expired — attempt refresh
	try {
		const refreshResult = await session.refresh()
		if (!refreshResult.authenticated || !refreshResult.sealedSession) {
			return c.json({ error: "Unauthorized" }, 401)
		}

		setCookie(c, "wos-session", refreshResult.sealedSession, {
			path: "/",
			httpOnly: true,
			secure: true,
			sameSite: "Lax",
			maxAge: 60 * 60 * 24 * 30,
		})

		c.set("db", db)
		c.set("workos", workos)
		c.set("authRow", { userId: refreshResult.user.id })
		return next()
	} catch {
		return c.json({ error: "Unauthorized" }, 401)
	}
})

export const workspaceMiddleware = createMiddleware<WorkspaceEnv>(
	async (c, next) => {
		const db = c.get("db")
		const authRow = c.get("authRow")
		let workspaceId = c.req.param("workspaceId")
		if (!workspaceId) return c.json({ error: "Workspace not found" }, 404)

		// Resolve "default" to the user's actual default workspace ID
		if (workspaceId === "default") {
			const [userOrg] = await db
				.select({
					defaultWorkspaceId: userOrganizationsTable.defaultWorkspaceId,
				})
				.from(userOrganizationsTable)
				.where(eq(userOrganizationsTable.userId, authRow.userId))
				.limit(1)

			if (!userOrg?.defaultWorkspaceId) {
				return c.json({ error: "No default workspace set" }, 404)
			}
			workspaceId = userOrg.defaultWorkspaceId
		}

		const [ws] = await db
			.select()
			.from(workspacesTable)
			.where(eq(workspacesTable.id, workspaceId!))
			.limit(1)

		if (!ws || ws.userId !== authRow.userId) {
			return c.json({ error: "Workspace not found" }, 404)
		}

		c.set("workspace", ws)
		await next()
	},
)
