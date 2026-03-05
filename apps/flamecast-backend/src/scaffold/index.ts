import flamecastWorkflow from "./flamecast.yml"
import flamecastOutputWorkflow from "./flamecast-output.yml"
import flamecastEmailAction from "./flamecast-email-action.yml"
import claudeMdTemplate from "./CLAUDE.md"
import recordContextScript from "./scripts/record-context.flamecast"
import commitOutputsScript from "./scripts/commit-outputs.flamecast"
import notifyLifecycleScript from "./scripts/notify-lifecycle.flamecast"
import prepareEmailScript from "./scripts/prepare-email.flamecast"
import sendEmailScript from "./scripts/send-email.flamecast"

const scriptsPackageJson = JSON.stringify(
	{
		private: true,
		dependencies: {
			"@flamecast/api":
				"https://pkg.stainless.com/s/flamecast-typescript/cda3a6d600de7a02fab9af1b713963a326692690/dist.tar.gz",
		},
	},
	null,
	2,
)

export const SCAFFOLD_FILES = [
	{
		path: ".github/workflows/flamecast.yml",
		content: flamecastWorkflow,
	},
	{
		path: ".github/workflows/flamecast-output.yml",
		content: flamecastOutputWorkflow,
	},
	{
		path: ".github/actions/flamecast-email/action.yml",
		content: flamecastEmailAction,
	},
	{
		path: ".github/scripts/package.json",
		content: scriptsPackageJson,
	},
	{
		path: ".github/scripts/record-context.ts",
		content: recordContextScript,
	},
	{
		path: ".github/scripts/commit-outputs.ts",
		content: commitOutputsScript,
	},
	{
		path: ".github/scripts/notify-lifecycle.ts",
		content: notifyLifecycleScript,
	},
	{
		path: ".github/scripts/prepare-email.ts",
		content: prepareEmailScript,
	},
	{
		path: ".github/scripts/send-email.ts",
		content: sendEmailScript,
	},
] as const

export { claudeMdTemplate }

export function getClaudeMdContent(systemPrompt?: string) {
	return systemPrompt
		? `${systemPrompt}\n\n${claudeMdTemplate}`
		: claudeMdTemplate
}

export function getScaffoldFilesBase64(systemPrompt?: string) {
	return [
		...SCAFFOLD_FILES.map(f => ({
			path: f.path,
			content: Buffer.from(f.content).toString("base64"),
		})),
		{
			path: "CLAUDE.md",
			content: Buffer.from(getClaudeMdContent(systemPrompt)).toString("base64"),
		},
	]
}
