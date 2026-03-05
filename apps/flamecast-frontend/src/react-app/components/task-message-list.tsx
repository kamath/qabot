import { formatDistanceToNow } from "date-fns"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface TaskMessage {
	id: string
	role: "user" | "agent"
	content: string
	createdAt: string
}

export function TaskMessageList({ messages }: { messages: TaskMessage[] }) {
	if (messages.length === 0) {
		return (
			<p className="py-8 text-center text-sm text-muted-foreground">
				No messages yet.
			</p>
		)
	}

	return (
		<ScrollArea className="h-[400px]">
			<div className="space-y-3 p-4">
				{messages.map(msg => (
					<div
						key={msg.id}
						className={cn(
							"flex",
							msg.role === "user" ? "justify-end" : "justify-start",
						)}
					>
						<div
							className={cn(
								"max-w-[80%] rounded-lg px-3 py-2 text-sm",
								msg.role === "user"
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground",
							)}
						>
							<p className="whitespace-pre-wrap">{msg.content}</p>
							<p
								className={cn(
									"mt-1 text-xs",
									msg.role === "user"
										? "text-primary-foreground/70"
										: "text-muted-foreground/70",
								)}
							>
								{formatDistanceToNow(new Date(msg.createdAt), {
									addSuffix: true,
								})}
							</p>
						</div>
					</div>
				))}
			</div>
		</ScrollArea>
	)
}
