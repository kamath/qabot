import { Octokit } from "@octokit/rest"
import { throttling } from "@octokit/plugin-throttling"

const ThrottledOctokit = Octokit.plugin(throttling)

export function getOctokit(accessToken: string) {
	return new ThrottledOctokit({
		auth: accessToken,
		throttle: {
			onRateLimit: (_retryAfter, options, octokit, retryCount) => {
				octokit.log.warn(`Rate limit hit for ${options.method} ${options.url}`)
				return retryCount < 2
			},
			onSecondaryRateLimit: (_retryAfter, options, octokit, retryCount) => {
				octokit.log.warn(
					`Secondary rate limit hit for ${options.method} ${options.url}`,
				)
				return retryCount < 1
			},
		},
	})
}

export type OctokitClient = ReturnType<typeof getOctokit>
