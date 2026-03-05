import { eq } from "drizzle-orm"
import type { drizzle } from "drizzle-orm/postgres-js"
import type { WorkOS } from "@workos-inc/node"
import { jwtVerify } from "jose"
import { githubOauthTokens, userOrganizations } from "@flamecast/db/schema"

const API_KEY_CACHE_TTL_MS = 60_000

const apiKeyCache = new Map<string, { userId: string; expiresAt: number }>()

export async function authenticateBearer(
	db: ReturnType<typeof drizzle>,
	authHeader: string | undefined,
	workos: WorkOS,
) {
	if (!authHeader) return null

	const match = authHeader.match(/^Bearer\s+(.+)$/i)
	if (!match) return null

	const token = match[1]

	const cached = apiKeyCache.get(token)
	if (cached && cached.expiresAt > Date.now()) {
		return { userId: cached.userId }
	}

	// Try JWT (WorkOS access token) first, then fall back to API key
	const jwtResult = await authenticateJwt(token, workos)
	if (jwtResult) {
		apiKeyCache.set(token, {
			userId: jwtResult.userId,
			expiresAt: Date.now() + API_KEY_CACHE_TTL_MS,
		})
		return jwtResult
	}

	return authenticateApiKey(db, token, workos)
}

async function authenticateJwt(
	token: string,
	workos: WorkOS,
): Promise<{ userId: string } | null> {
	try {
		const jwks = await workos.userManagement.getJWKS()
		if (!jwks) return null

		const { payload } = await jwtVerify(token, jwks)
		const userId = payload.sub
		if (!userId) return null

		return { userId }
	} catch {
		return null
	}
}

async function authenticateApiKey(
	db: ReturnType<typeof drizzle>,
	token: string,
	workos: WorkOS,
): Promise<{ userId: string } | null> {
	try {
		const result = await workos.apiKeys.validateApiKey({ value: token })
		if (!result.apiKey) return null

		const organizationId = result.apiKey.owner.id

		const [row] = await db
			.select({ userId: userOrganizations.userId })
			.from(userOrganizations)
			.where(eq(userOrganizations.organizationId, organizationId))
			.limit(1)

		if (!row) return null

		apiKeyCache.set(token, {
			userId: row.userId,
			expiresAt: Date.now() + API_KEY_CACHE_TTL_MS,
		})

		return { userId: row.userId }
	} catch {
		return null
	}
}

export async function getGitHubAccessToken(
	db: ReturnType<typeof drizzle>,
	userId: string,
) {
	const [tokenRow] = await db
		.select({ accessToken: githubOauthTokens.accessToken })
		.from(githubOauthTokens)
		.where(eq(githubOauthTokens.userId, userId))
		.limit(1)

	return tokenRow?.accessToken ?? null
}

export function getGitHubHeaders(accessToken: string) {
	return {
		Authorization: `token ${accessToken}`,
		Accept: "application/vnd.github.v3+json",
		"User-Agent": "flamecast-backend",
	}
}
