import { readFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { execSync } from "node:child_process"

const ROOT = join(import.meta.dirname, "..")
const ENTRY = join(ROOT, "src", "cli.ts")
const OUT_DIR = join(ROOT, "dist", "bin")

const TARGETS = [
	{ bunTarget: "bun-darwin-arm64", output: "flame-darwin-arm64" },
	{ bunTarget: "bun-darwin-x64", output: "flame-darwin-x64" },
	{ bunTarget: "bun-linux-arm64", output: "flame-linux-arm64" },
	{ bunTarget: "bun-linux-x64", output: "flame-linux-x64" },
]

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"))
const version: string = pkg.version

mkdirSync(OUT_DIR, { recursive: true })

// Accept optional filter: "local" auto-detects, or a specific target like "darwin-arm64"
const filter = process.argv[2]

function localTarget(): string {
	const os = process.platform === "darwin" ? "darwin" : "linux"
	const arch = process.arch === "arm64" ? "arm64" : "x64"
	return `${os}-${arch}`
}

const selected =
	filter === "local"
		? TARGETS.filter(t => t.output.includes(localTarget()))
		: filter
			? TARGETS.filter(t => t.output.includes(filter))
			: TARGETS

if (selected.length === 0) {
	console.error(`No targets matched filter: ${filter}`)
	process.exit(1)
}

for (const { bunTarget, output } of selected) {
	const outPath = join(OUT_DIR, output)
	console.log(`Compiling ${output} (${bunTarget})...`)
	execSync(
		`bun build --compile --target=${bunTarget} --define '__FLAME_VERSION__="${version}"' --outfile ${outPath} ${ENTRY}`,
		{ stdio: "inherit", cwd: ROOT },
	)
}

console.log(`\nDone. Binaries written to dist/bin/`)
