import { defineConfig } from "vitest/config"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "../..")

export default defineConfig({
	assetsInclude: ["**/*.md", "**/*.yml", "**/*.flamecast"],
	test: {
		globals: true,
	},
	resolve: {
		alias: {
			"@flamecast/db/schema": path.join(
				root,
				"packages/db/src/schema/index.ts",
			),
			"@flamecast/db": path.join(root, "packages/db/src/index.ts"),
			"@flamecast/utils/openapi": path.join(
				root,
				"packages/utils/src/openapi.ts",
			),
		},
	},
})
