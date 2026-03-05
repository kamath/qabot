import { useState } from "react"
import { useSetSecrets, useCreateApiKey } from "@/lib/mutations"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	CheckCircle2Icon,
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	KeyRoundIcon,
	PlusIcon,
	ShieldIcon,
	TerminalIcon,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

type DialogType = "claude" | "github" | "flamecast" | "custom" | null

export function WorkspaceSecretsCard({
	workspaceId,
	workspaceName,
	githubRepo,
	secretNames,
	isRotating,
}: {
	workspaceId: string
	workspaceName: string
	githubRepo: string
	secretNames?: string[]
	isRotating?: boolean
}) {
	const hasClaudeToken = secretNames?.includes("CLAUDE_CODE_OAUTH_TOKEN")
	const hasGithubPat = secretNames?.includes("FLAMECAST_PAT")
	const hasFlamecastApiKey = secretNames?.includes("FLAMECAST_API_KEY")
	const [activeDialog, setActiveDialog] = useState<DialogType>(null)
	const [secretValue, setSecretValue] = useState("")
	const [customKey, setCustomKey] = useState("")
	const [editingSecretName, setEditingSecretName] = useState<string | null>(
		null,
	)
	const [flamecastKeyName, setFlamecastKeyName] = useState("")
	const [flamecastCreatedKey, setFlamecastCreatedKey] = useState<string | null>(
		null,
	)
	const [flamecastCopied, setFlamecastCopied] = useState(false)
	const [tokenWarning, setTokenWarning] = useState<string | null>(null)
	const setSecrets = useSetSecrets(workspaceId)
	const createApiKey = useCreateApiKey()

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!secretValue) return

		let secrets: Record<string, string>
		if (activeDialog === "claude") {
			secrets = {
				CLAUDE_CODE_OAUTH_TOKEN: secretValue.replace(/[\r\n]/g, "").trim(),
			}
		} else if (activeDialog === "github") {
			secrets = { FLAMECAST_PAT: secretValue.trim() }
		} else if (activeDialog === "custom" && customKey) {
			secrets = { [customKey]: secretValue.trim() }
		} else {
			return
		}

		setSecrets.mutate(secrets, {
			onSuccess: () => {
				setActiveDialog(null)
				setSecretValue("")
				setCustomKey("")
			},
		})
	}

	function openEditSecret(name: string) {
		setEditingSecretName(name)
		setCustomKey(name)
		setActiveDialog("custom")
	}

	function closeDialog() {
		setActiveDialog(null)
		setSecretValue("")
		setCustomKey("")
		setEditingSecretName(null)
		setFlamecastKeyName("")
		setFlamecastCreatedKey(null)
		setFlamecastCopied(false)
		setTokenWarning(null)
		setSecrets.reset()
		createApiKey.reset()
	}

	function handleCreateFlamecastKey(e: React.FormEvent) {
		e.preventDefault()
		createApiKey.mutate(
			{ name: flamecastKeyName || undefined },
			{
				onSuccess: result => {
					const { key } = result as { key: string }
					setFlamecastCreatedKey(key)
					setSecrets.mutate(
						{ FLAMECAST_API_KEY: key },
						{ onSuccess: () => setFlamecastKeyName("") },
					)
				},
			},
		)
	}

	async function copyFlamecastKey() {
		if (!flamecastCreatedKey) return
		await navigator.clipboard.writeText(flamecastCreatedKey)
		setFlamecastCopied(true)
		setTimeout(() => setFlamecastCopied(false), 2000)
	}

	const secretsUrl = `https://github.com/${githubRepo}/settings/secrets/actions`
	const patUrl = `https://github.com/settings/tokens/new?scopes=workflow,repo&description=flamecast-${workspaceName}`

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Secrets</CardTitle>
					<CardDescription>
						Secrets are stored securely as{" "}
						<a
							href={secretsUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
						>
							GitHub repository secrets
							<ExternalLinkIcon className="size-3" />
						</a>
						. They are available to your workspace agent at runtime.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{isRotating && (
						<div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
							<Spinner />
							Rotating tokens…
						</div>
					)}
					<div className="flex flex-wrap gap-3">
						{!hasClaudeToken && (
							<button
								type="button"
								onClick={() => setActiveDialog("claude")}
								className="flex items-start gap-3 rounded-lg border border-accent bg-accent/10 p-4 text-left transition-colors hover:bg-accent/20"
							>
								<TerminalIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
								<div>
									<p className="font-medium text-sm">Add Claude Code Token</p>
									<p className="text-xs text-muted-foreground">
										Required for Claude Code agent access
									</p>
								</div>
							</button>
						)}

						{!hasGithubPat && (
							<button
								type="button"
								onClick={() => setActiveDialog("github")}
								className="flex items-start gap-3 rounded-lg border border-accent bg-accent/10 p-4 text-left transition-colors hover:bg-accent/20"
							>
								<ShieldIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
								<div>
									<p className="font-medium text-sm">Add GitHub Access Token</p>
									<p className="text-xs text-muted-foreground">
										Required for repo and workflow access
									</p>
								</div>
							</button>
						)}

						{!hasFlamecastApiKey && (
							<button
								type="button"
								onClick={() => setActiveDialog("flamecast")}
								className="flex items-start gap-3 rounded-lg border border-accent bg-accent/10 p-4 text-left transition-colors hover:bg-accent/20"
							>
								<KeyRoundIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
								<div>
									<p className="font-medium text-sm">Add Flamecast API Key</p>
									<p className="text-xs text-muted-foreground">
										Required for Flamecast API access
									</p>
								</div>
							</button>
						)}

						<button
							type="button"
							onClick={() => setActiveDialog("custom")}
							className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
						>
							<PlusIcon className="size-4" />
							Add Custom Secret
						</button>
					</div>

					{secretNames && secretNames.length > 0 && (
						<div className="space-y-1">
							{secretNames.map(name => {
								const updateAction =
									name === "CLAUDE_CODE_OAUTH_TOKEN"
										? () => setActiveDialog("claude")
										: name === "FLAMECAST_PAT"
											? () => setActiveDialog("github")
											: name === "FLAMECAST_API_KEY"
												? () => setActiveDialog("flamecast")
												: () => openEditSecret(name)
								return (
									<div
										key={name}
										className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
									>
										<span className="flex items-center gap-2 text-muted-foreground">
											<CheckCircle2Icon className="size-3.5 text-green-500" />
											{name}
										</span>
										<button
											type="button"
											onClick={updateAction}
											className="text-xs text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
										>
											Update
										</button>
									</div>
								)
							})}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Claude Code Token Dialog */}
			<Dialog
				open={activeDialog === "claude"}
				onOpenChange={open => !open && closeDialog()}
			>
				<DialogContent>
					<form onSubmit={handleSubmit}>
						<DialogHeader>
							<DialogTitle>
								{hasClaudeToken ? "Update" : "Add"} Claude Code Token
							</DialogTitle>
							<DialogDescription>
								Run the following command in your terminal, then paste the
								result below.
							</DialogDescription>
						</DialogHeader>
						<div className="mt-4 space-y-4">
							<div className="rounded-md bg-muted px-4 py-3">
								<code className="text-sm">claude setup-token</code>
							</div>
							<div className="space-y-2">
								<Label htmlFor="claude-token">Token</Label>
								<Input
									id="claude-token"
									type="password"
									placeholder="Paste your token here"
									value={secretValue}
									onChange={e => {
										const raw = e.target.value
										if (/[\n\r\t]/.test(raw)) {
											setSecretValue(raw.replace(/\s/g, ""))
											setTokenWarning(
												"Line breaks were detected and removed from your token. This can happen when copying from a narrow terminal window.",
											)
										} else {
											setSecretValue(raw)
											setTokenWarning(null)
										}
									}}
									required
								/>
								{tokenWarning && (
									<p className="text-xs text-amber-500">{tokenWarning}</p>
								)}
							</div>
						</div>
						<DialogFooter className="mt-6">
							<Button
								type="submit"
								disabled={!secretValue || setSecrets.isPending}
							>
								{setSecrets.isPending ? "Saving..." : "Save"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* GitHub Access Token Dialog */}
			<Dialog
				open={activeDialog === "github"}
				onOpenChange={open => !open && closeDialog()}
			>
				<DialogContent>
					<form onSubmit={handleSubmit}>
						<DialogHeader>
							<DialogTitle>
								{hasGithubPat ? "Update" : "Add"} GitHub Access Token
							</DialogTitle>
							<DialogDescription>
								Generate a new personal access token and paste it below.
							</DialogDescription>
						</DialogHeader>
						<div className="mt-4 space-y-4">
							<a
								href={patUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 rounded-md bg-muted px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/80"
							>
								Generate token on GitHub
								<ExternalLinkIcon className="size-3.5" />
							</a>
							<p className="text-xs text-muted-foreground">
								This will open GitHub with the correct scopes pre-selected.
								Click "Generate token" and copy the result.
							</p>
							<div className="space-y-2">
								<Label htmlFor="github-pat">Token</Label>
								<Input
									id="github-pat"
									type="password"
									placeholder="Paste your token here"
									value={secretValue}
									onChange={e => setSecretValue(e.target.value)}
									required
								/>
							</div>
						</div>
						<DialogFooter className="mt-6">
							<Button
								type="submit"
								disabled={!secretValue || setSecrets.isPending}
							>
								{setSecrets.isPending ? "Saving..." : "Save"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Custom Secret Dialog */}
			<Dialog
				open={activeDialog === "custom"}
				onOpenChange={open => !open && closeDialog()}
			>
				<DialogContent>
					<form onSubmit={handleSubmit}>
						<DialogHeader>
							<DialogTitle>
								{editingSecretName ? "Update" : "Add"} Custom Secret
							</DialogTitle>
							<DialogDescription>
								{editingSecretName
									? "Enter a new value for this secret."
									: "Add a secret that will be available to your workspace agent as an environment variable."}
							</DialogDescription>
						</DialogHeader>
						<div className="mt-4 space-y-4">
							<div className="space-y-2">
								<Label htmlFor="secret-key">Secret Name</Label>
								<Input
									id="secret-key"
									placeholder="e.g. MY_API_KEY"
									value={customKey}
									onChange={e => setCustomKey(e.target.value.toUpperCase())}
									disabled={!!editingSecretName}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="secret-value">Secret Value</Label>
								<Input
									id="secret-value"
									type="password"
									placeholder="Enter secret value"
									value={secretValue}
									onChange={e => setSecretValue(e.target.value)}
									required
								/>
							</div>
						</div>
						<DialogFooter className="mt-6">
							<Button
								type="submit"
								disabled={!secretValue || !customKey || setSecrets.isPending}
							>
								{setSecrets.isPending ? "Saving..." : "Save"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Flamecast API Key Dialog */}
			<Dialog
				open={activeDialog === "flamecast"}
				onOpenChange={open => !open && closeDialog()}
			>
				<DialogContent>
					{!flamecastCreatedKey ? (
						<form onSubmit={handleCreateFlamecastKey}>
							<DialogHeader>
								<DialogTitle>
									{hasFlamecastApiKey ? "Regenerate" : "Add"} Flamecast API Key
								</DialogTitle>
								<DialogDescription>
									Create a new Flamecast API key and store it as a workspace
									secret.
								</DialogDescription>
							</DialogHeader>
							<div className="mt-4 space-y-4">
								<div className="space-y-2">
									<Label htmlFor="flamecast-key-name">Name (optional)</Label>
									<Input
										id="flamecast-key-name"
										placeholder="e.g. Production, CI/CD"
										value={flamecastKeyName}
										onChange={e => setFlamecastKeyName(e.target.value)}
									/>
								</div>
							</div>
							<DialogFooter className="mt-6">
								<Button
									type="submit"
									disabled={createApiKey.isPending || setSecrets.isPending}
								>
									{createApiKey.isPending || setSecrets.isPending ? (
										<>
											<Spinner />
											Creating…
										</>
									) : (
										"Create & Save"
									)}
								</Button>
							</DialogFooter>
						</form>
					) : (
						<>
							<DialogHeader>
								<DialogTitle>API Key Created</DialogTitle>
								<DialogDescription>
									Copy your key now. You won't be able to see it again.
								</DialogDescription>
							</DialogHeader>
							<div className="mt-4">
								<div className="flex items-center gap-2">
									<code className="flex-1 rounded-md bg-muted px-4 py-3 text-sm font-mono break-all">
										{flamecastCreatedKey}
									</code>
									<Button
										variant="outline"
										size="icon"
										onClick={copyFlamecastKey}
									>
										{flamecastCopied ? (
											<CheckIcon className="size-4" />
										) : (
											<CopyIcon className="size-4" />
										)}
									</Button>
								</div>
							</div>
							<DialogFooter className="mt-6">
								<Button onClick={closeDialog}>Done</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	)
}
