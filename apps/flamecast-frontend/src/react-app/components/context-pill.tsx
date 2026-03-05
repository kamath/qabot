import { Link } from "@tanstack/react-router"
import { XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { FlameSpinner } from "@/components/ui/flame-spinner"

export type ContextItem = {
	source: "github_repo" | "github_pr" | "flamecast_run"
	source_id: string
}

export function contextKey(item: ContextItem) {
	return `${item.source}:${item.source_id}`
}

export function formatContextLabel(item: ContextItem) {
	if (item.source === "flamecast_run") return `Run #${item.source_id}`
	const prMatch = item.source_id.match(
		/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/([0-9]+)(?:[/?#].*)?$/i,
	)
	if (prMatch) {
		const [, repoName, pullNumber] = prMatch
		return `${repoName} #${pullNumber}`
	}
	return item.source_id
}

function contextExternalHref(item: ContextItem): string | null {
	if (item.source === "flamecast_run") return null
	return item.source_id.startsWith("http")
		? item.source_id
		: `https://github.com/${item.source_id}`
}

export function ContextPill({
	item,
	workspaceId,
	onRemove,
}: {
	item: ContextItem
	workspaceId?: string
	onRemove?: (item: ContextItem) => void
}) {
	const label = formatContextLabel(item)
	const content = (
		<>
			{item.source === "flamecast_run" ? (
				<FlameSpinner className="size-3 text-orange-500" animated={false} />
			) : (
				<img
					src="https://github.com/favicon.ico"
					className="size-3 rounded-sm"
					alt=""
				/>
			)}
			{label}
			{onRemove && (
				<button
					type="button"
					onClick={() => onRemove(item)}
					className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
					aria-label={`Remove ${label}`}
				>
					<XIcon className="size-3" />
				</button>
			)}
		</>
	)

	if (onRemove) {
		return (
			<Badge variant="secondary" className="gap-1.5 text-xs pl-1.5">
				{content}
			</Badge>
		)
	}

	if (item.source === "flamecast_run" && workspaceId) {
		return (
			<Badge variant="secondary" className="gap-1.5 text-xs pl-1.5" asChild>
				<Link
					to="/workspaces/$workspaceId/tasks/$taskId"
					params={{ workspaceId, taskId: item.source_id }}
				>
					{content}
				</Link>
			</Badge>
		)
	}

	const href = contextExternalHref(item)
	if (href) {
		return (
			<Badge variant="secondary" className="gap-1.5 text-xs pl-1.5" asChild>
				<a href={href} target="_blank" rel="noopener noreferrer">
					{content}
				</a>
			</Badge>
		)
	}

	return (
		<Badge variant="secondary" className="gap-1.5 text-xs pl-1.5">
			{content}
		</Badge>
	)
}
