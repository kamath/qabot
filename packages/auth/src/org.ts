import { eq } from "drizzle-orm"
import type { drizzle } from "drizzle-orm/postgres-js"
import type { WorkOS } from "@workos-inc/node"
import { userOrganizations } from "@flamecast/db/schema"

export async function ensurePersonalOrganization(
	workos: WorkOS,
	db: ReturnType<typeof drizzle>,
	userId: string,
	userEmail: string,
) {
	const [existing] = await db
		.select({ organizationId: userOrganizations.organizationId })
		.from(userOrganizations)
		.where(eq(userOrganizations.userId, userId))
		.limit(1)

	if (existing) return existing.organizationId

	const org = await workos.organizations.createOrganization({
		name: `${userEmail}'s org`,
	})

	await db
		.insert(userOrganizations)
		.values({ userId, organizationId: org.id })
		.onConflictDoNothing()

	return org.id
}
