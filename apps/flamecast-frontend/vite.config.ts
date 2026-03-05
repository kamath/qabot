import path from "node:path"
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [
		TanStackRouterVite({
			routesDirectory: "./src/react-app/routes",
			generatedRouteTree: "./src/react-app/routeTree.gen.ts",
		}),
		react(),
		tailwindcss(),
		cloudflare(),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src/react-app"),
		},
	},
})
