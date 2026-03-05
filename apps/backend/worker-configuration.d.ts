declare namespace Cloudflare {
	interface GlobalProps {
		mainModule: typeof import("./src/index");
	}

	interface Env {}
}

interface CloudflareBindings extends Cloudflare.Env {}
