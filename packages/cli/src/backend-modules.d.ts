// Type declarations for backend text module imports resolved through the path mapping
declare module "*.md" {
	const content: string
	export default content
}

declare module "*.yml" {
	const content: string
	export default content
}
