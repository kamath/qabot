import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { useTrackEvent, AnalyticsEvents } from "@/lib/analytics"
import { Outlet, Link, useMatches, useParams } from "@tanstack/react-router"
import { useTheme } from "next-themes"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { useAuth } from "../lib/auth-context"
import { useApiClientOrNull } from "@/lib/api-context"
import { defaultWorkspaceQuery, tasksListQuery } from "@/lib/queries"
import { useArchiveTask, useUnarchiveTask } from "@/lib/mutations"
import { TaskStatusIcon } from "@/components/task-status-icon"
import {
	HomeIcon,
	LayoutDashboardIcon,
	KeyRoundIcon,
	LogOutIcon,
	ChevronsUpDownIcon,
	PanelLeftIcon,
	SunIcon,
	MoonIcon,
	ArchiveIcon,
	Loader2Icon,
	RotateCcwIcon,
} from "lucide-react"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	useSidebar,
} from "@/components/ui/sidebar"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { MASCOT_MAP, MASCOT_PNG_FILEPATH } from "@/lib/consts"

type SidebarTaskStatus =
	| "submitted"
	| "working"
	| "input_required"
	| "completed"
	| "failed"
	| "cancelled"
	| "archived"

type SidebarTask = {
	id: string
	prompt: string
	createdAt: string
	status: SidebarTaskStatus
	workflowRunId: number | null
}

function SidebarTriggerWithLogo() {
	const { toggleSidebar, open, isMobile } = useSidebar()
	const [hovered, setHovered] = useState(false)

	const showLogo = !isMobile && !open && !hovered

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			onClick={toggleSidebar}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			className="relative"
		>
			<div
				className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
					showLogo ? "scale-100 opacity-100" : "scale-75 opacity-0"
				}`}
			>
				<div className="flex size-12 items-center justify-center rounded-lg overflow-hidden">
					<img
						src={`${MASCOT_PNG_FILEPATH}/${MASCOT_MAP.FLAME_SHOUTING}.png`}
						alt="Flamecast"
						className="object-contain size-12"
					/>
				</div>
			</div>
			<PanelLeftIcon
				className={`transition-all duration-300 ${
					showLogo ? "scale-75 opacity-0" : "scale-100 opacity-100"
				}`}
			/>
			<span className="sr-only">Toggle Sidebar</span>
		</Button>
	)
}

function SidebarRecentTasks() {
	const client = useApiClientOrNull()
	const { data: defaultData } = useQuery({
		...defaultWorkspaceQuery(client!),
		enabled: !!client,
	})
	const workspaceId = defaultData?.defaultWorkspaceId
	const archiveTask = useArchiveTask(workspaceId ?? "")
	const unarchiveTask = useUnarchiveTask(workspaceId ?? "")
	const [pendingTaskActionIds, setPendingTaskActionIds] = useState(
		() => new Set<string>(),
	)
	const archiveLockRef = useRef(new Set<string>())
	const lastArchiveClickAtRef = useRef(0)
	const { data, isLoading } = useQuery({
		...tasksListQuery(client!, workspaceId ?? ""),
		enabled: !!client && !!workspaceId,
	})
	const tasks = (data?.tasks ?? []) as SidebarTask[]
	const { taskId: activeTaskId } = useParams({ strict: false }) as {
		taskId?: string
	}

	function handleTaskStatusAction(
		taskId: string,
		action: "archive" | "unarchive",
	) {
		const now = Date.now()
		if (now - lastArchiveClickAtRef.current < 250) return
		if (archiveLockRef.current.has(taskId)) return

		lastArchiveClickAtRef.current = now
		archiveLockRef.current.add(taskId)
		setPendingTaskActionIds(prev => new Set(prev).add(taskId))

		const mutation = action === "archive" ? archiveTask : unarchiveTask
		mutation.mutate(taskId, {
			onSettled: () => {
				archiveLockRef.current.delete(taskId)
				setPendingTaskActionIds(prev => {
					const next = new Set(prev)
					next.delete(taskId)
					return next
				})
			},
		})
	}

	if (!client || !workspaceId) return null

	if (isLoading) {
		return (
			<SidebarGroup>
				<SidebarGroupLabel>Recent Tasks</SidebarGroupLabel>
				<SidebarGroupContent>
					<div className="space-y-2 px-2">
						{[1, 2, 3].map(i => (
							<Skeleton key={i} className="h-7 w-full rounded-md" />
						))}
					</div>
				</SidebarGroupContent>
			</SidebarGroup>
		)
	}

	if (tasks.length === 0) {
		return (
			<SidebarGroup>
				<SidebarGroupLabel>Recent Tasks</SidebarGroupLabel>
				<SidebarGroupContent>
					<p className="px-2 text-xs text-muted-foreground">No recent tasks</p>
				</SidebarGroupContent>
			</SidebarGroup>
		)
	}

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Recent Tasks</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{tasks.map(task => (
						<SidebarMenuItem key={task.id}>
							<SidebarMenuButton
								asChild
								className={`h-auto py-3 group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground group-has-data-[sidebar=menu-action]/menu-item:!pr-2 ${
									task.status === "archived" ? "opacity-60" : ""
								} ${
									task.id === activeTaskId
										? "bg-sidebar-accent text-sidebar-accent-foreground"
										: ""
								}`}
							>
								<Link
									to="/workspaces/$workspaceId/tasks/$taskId"
									params={{ workspaceId, taskId: task.id }}
								>
									{task.status !== "completed" && (
										<TaskStatusIcon status={task.status} />
									)}
									<div className="flex flex-col gap-0.5 min-w-0">
										<span
											className={`truncate text-xs ${
												task.status === "archived"
													? "text-muted-foreground"
													: ""
											}`}
										>
											{task.prompt}
										</span>
										<span
											className={`text-2xs flex items-center gap-1 ${
												task.status === "archived"
													? "text-muted-foreground/80"
													: "text-muted-foreground"
											}`}
										>
											{task.workflowRunId != null && (
												<span>...{String(task.workflowRunId).slice(-4)} ·</span>
											)}
											{formatDistanceToNow(new Date(task.createdAt), {
												addSuffix: true,
											})}
										</span>
									</div>
								</Link>
							</SidebarMenuButton>
							{(task.status === "completed" ||
								task.status === "failed" ||
								task.status === "cancelled" ||
								task.status === "archived") && (
								<SidebarMenuAction
									showOnHover={task.id !== activeTaskId}
									className={cn(
										"top-1/2 -translate-y-1/2 peer-data-[size=default]/menu-button:top-1/2 peer-data-[size=sm]/menu-button:top-1/2 peer-data-[size=lg]/menu-button:top-1/2 z-10 h-6 w-6 bg-sidebar/75 backdrop-blur-[1px]",
										task.id === activeTaskId &&
											"peer-data-active/menu-button:text-sidebar-accent-foreground group-hover/menu-item:opacity-100 aria-expanded:opacity-100 md:opacity-0",
									)}
									disabled={pendingTaskActionIds.has(task.id)}
									onClick={event => {
										event.preventDefault()
										event.stopPropagation()
										handleTaskStatusAction(
											task.id,
											task.status === "archived" ? "unarchive" : "archive",
										)
									}}
									aria-label={
										task.status === "archived"
											? "Unarchive task"
											: "Archive task"
									}
									title={
										task.status === "archived"
											? "Unarchive task"
											: "Archive task"
									}
								>
									{pendingTaskActionIds.has(task.id) ? (
										<Loader2Icon className="animate-spin" />
									) : task.status === "archived" ? (
										<RotateCcwIcon />
									) : (
										<ArchiveIcon />
									)}
								</SidebarMenuAction>
							)}
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	)
}

function AppSidebar() {
	const { user, signIn, signOut } = useAuth()
	const initials = user?.firstName
		? `${user.firstName[0]}${user.lastName?.[0] ?? ""}`
		: "U"

	return (
		<Sidebar>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link to="/">
								<div className="flex size-6 items-center justify-center rounded-lg overflow-hidden">
									<img
										src={`${MASCOT_PNG_FILEPATH}/${MASCOT_MAP.FLAME_SHOUTING}.png`}
										alt="Flamecast"
										className="object-contain size-6"
									/>
								</div>
								<div className="flex flex-col gap-0.5 leading-none">
									<span className="font-semibold text-3xl">Flamecast</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton asChild>
									<Link to="/">
										<HomeIcon />
										<span>Home</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarRecentTasks />
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						{user ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<SidebarMenuButton
										size="lg"
										className="data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
									>
										<Avatar className="size-8">
											<AvatarFallback className="bg-muted text-muted-foreground text-xs">
												{initials}
											</AvatarFallback>
										</Avatar>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-semibold">
												{user.firstName} {user.lastName}
											</span>
											<span className="truncate text-xs text-muted-foreground">
												{user.email}
											</span>
										</div>
										<ChevronsUpDownIcon className="ml-auto size-4" />
									</SidebarMenuButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
									side="top"
									align="start"
								>
									<DropdownMenuItem asChild>
										<Link to="/workspaces">
											<LayoutDashboardIcon />
											Workspaces
										</Link>
									</DropdownMenuItem>
									<DropdownMenuItem asChild>
										<Link to="/api-keys">
											<KeyRoundIcon />
											API Keys
										</Link>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={() => signOut()}>
										<LogOutIcon />
										Sign out
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : (
							<SidebarMenuButton size="lg" onClick={() => signIn()}>
								<LogOutIcon className="rotate-180" />
								<span>Sign in</span>
							</SidebarMenuButton>
						)}
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	)
}

function AppBreadcrumbs() {
	const matches = useMatches()
	const crumbs = matches
		.filter(m => m.pathname !== "/")
		.map(m => ({
			path: m.pathname,
			label: m.pathname.split("/").filter(Boolean).pop() ?? "",
		}))

	if (crumbs.length === 0) return null

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{crumbs.map((crumb, i) => {
					const isLast = i === crumbs.length - 1
					return (
						<span key={crumb.path} className="contents">
							{i > 0 && <BreadcrumbSeparator />}
							<BreadcrumbItem>
								{isLast ? (
									<BreadcrumbPage className="capitalize">
										{crumb.label}
									</BreadcrumbPage>
								) : (
									<BreadcrumbLink asChild>
										<Link to={crumb.path} className="capitalize">
											{crumb.label}
										</Link>
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
						</span>
					)
				})}
			</BreadcrumbList>
		</Breadcrumb>
	)
}

function ThemeToggle() {
	const { theme, setTheme } = useTheme()
	const trackEvent = useTrackEvent()
	return (
		<Button
			variant="ghost"
			size="icon-sm"
			className="ml-auto"
			onClick={() => {
				const newTheme = theme === "dark" ? "light" : "dark"
				trackEvent(AnalyticsEvents.THEME_TOGGLED, { theme: newTheme })
				setTheme(newTheme)
			}}
		>
			<SunIcon className="scale-100 dark:scale-0" />
			<MoonIcon className="absolute scale-0 dark:scale-100" />
			<span className="sr-only">Toggle theme</span>
		</Button>
	)
}

export function RootLayout() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTriggerWithLogo />
					<Separator orientation="vertical" className="mx-2" />
					<AppBreadcrumbs />
					<ThemeToggle />
				</header>
				<main className="flex-1 overflow-auto p-4 md:p-8">
					<Outlet />
				</main>
			</SidebarInset>
		</SidebarProvider>
	)
}
