import {
	CheckCircle2Icon,
	XCircleIcon,
	CircleDotIcon,
	ArchiveIcon,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

export function TaskStatusIcon({ status }: { status: string }) {
	switch (status) {
		case "completed":
			return <CheckCircle2Icon className="size-4 shrink-0 text-green-500" />
		case "failed":
			return <XCircleIcon className="size-4 shrink-0 text-destructive" />
		case "working":
		case "submitted":
			return <Spinner className="size-4 shrink-0" />
		case "input_required":
			return <CircleDotIcon className="size-4 shrink-0 text-yellow-500" />
		case "cancelled":
			return <XCircleIcon className="size-4 shrink-0 text-muted-foreground" />
		case "archived":
			return <ArchiveIcon className="size-4 shrink-0 text-muted-foreground" />
		default:
			return null
	}
}
