const fs = require("node:fs")
const path = require("node:path")

const dir = path.join(
	process.cwd(),
	"apps/flamecast-frontend/public/brand/Mascot/SVG",
)

console.log("Generating 10 new Mascot SVGs...")

for (let i = 1; i <= 10; i++) {
	const originalName = `Mascot_${i.toString().padStart(2, "0")}.svg`
	const newName = `Mascot_${(i + 10).toString().padStart(2, "0")}.svg`

	const originalPath = path.join(dir, originalName)
	const newPath = path.join(dir, newName)

	if (fs.existsSync(originalPath)) {
		let content = fs.readFileSync(originalPath, "utf8")

		// Create a "Blue Fire" variant for the 10 new SVGs
		// Replace Orange (#ff5601) with Blue (#0096c7)
		content = content.replace(/#ff5601/gi, "#0096c7")
		// Replace Yellow (#ffdc4a) with Light Blue (#48cae4)
		content = content.replace(/#ffdc4a/gi, "#48cae4")

		fs.writeFileSync(newPath, content)
		console.log(
			`✅ Generated ${newName} from ${originalName} (Blue Fire variant)`,
		)
	} else {
		console.error(`❌ Could not find ${originalPath}`)
	}
}

console.log("\nAll done! 10 new SVGs have been generated.")
