import { cn } from "@/lib/utils"
import { FlameSpinner } from "@/components/ui/flame-spinner"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
	return <FlameSpinner className={cn("size-4", className)} {...props} />
}

export { Spinner }
