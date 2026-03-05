import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

import { defineConfig } from "drizzle-kit"

export default defineConfig({
	schema: "./src/schema/index.ts",
	out: "./src/migrations",
	dialect: "postgresql",
	schemaFilter: ["flamecast"],
	migrations: {
		table: "__drizzle_migrations",
		schema: "flamecast",
	},
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
})
