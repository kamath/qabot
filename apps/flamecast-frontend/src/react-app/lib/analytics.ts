import { useEffect } from "react"
import { usePostHog } from "@posthog/react"

export const AnalyticsEvents = {
	PAGE_VIEW: "$pageview",
	TASK_DISPATCHED: "task_dispatched",
	THEME_TOGGLED: "theme_toggled",
} as const

export function useTrackPageView(
	page: string,
	properties?: Record<string, unknown>,
) {
	const posthog = usePostHog()
	useEffect(() => {
		posthog?.capture(AnalyticsEvents.PAGE_VIEW, { page, ...properties })
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [posthog, page])
}

export function useTrackEvent() {
	const posthog = usePostHog()
	return (
		event: (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents],
		properties?: Record<string, unknown>,
	) => {
		posthog?.capture(event, properties)
	}
}
