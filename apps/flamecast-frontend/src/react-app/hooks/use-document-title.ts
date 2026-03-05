import { useEffect } from "react"

const APP_NAME = "Flamecast"

export function useDocumentTitle(title?: string) {
	useEffect(() => {
		if (typeof document === "undefined") return

		const normalizedTitle =
			typeof title === "string" && title.trim().length > 0 ? title : undefined
		document.title = normalizedTitle
			? `${normalizedTitle} - ${APP_NAME}`
			: APP_NAME
	}, [title])
}
