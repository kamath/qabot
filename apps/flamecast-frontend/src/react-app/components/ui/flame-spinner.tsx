import { cn } from "@/lib/utils"

function FlameSpinner({
	className,
	animated = true,
	...props
}: React.ComponentProps<"svg"> & { animated?: boolean }) {
	return (
		<svg
			role="status"
			aria-label="Loading"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 290 315"
			className={cn("size-4", className)}
			{...props}
		>
			<style>{`
				@keyframes flame-dash {
					0% {
						stroke-dashoffset: 850;
						fill: transparent;
						stroke-opacity: 1;
					}
					25% {
						stroke-dashoffset: 0;
						fill: transparent;
					}
					50% {
						stroke-dashoffset: 0;
						fill: #ff5601;
					}
				}
				@keyframes flame-scale {
					0% { opacity: 0; }
					50% { opacity: 0; }
					100% { opacity: 1; }
				}
				.flame-path {
					stroke-dasharray: 850;
					stroke-dashoffset: 0;
					animation: ${animated ? "flame-dash 4s infinite" : "none"};
					fill: #ff5601;
					stroke: #ff5601;
					opacity: 1;
				}
				.flame-inner {
					opacity: 1;
					animation: ${animated ? "flame-scale 4s infinite" : "none"};
				}
			`}</style>
			<path
				className="flame-path"
				strokeWidth="4"
				d="M174.54,103.7c31.32-49.8-16.13-92-52.95-84.76,0,0,27.9,41.02-5.27,63.82,2.78-20.55-14.78-32.09-34.04-28.87,0,0,19.73,20.06-22.32,61.17-4.62,4.51-38.69,36.67-33.75,82.36,4.34,40.09,29.39,64.73,69.54,75.71,44.74,12.23,108.23,8.65,134.92-47.78,41.9-88.56-56.14-121.64-56.14-121.64h0Z"
			/>
			<path
				className="flame-inner"
				fill="#ffdc4a"
				d="M79.54,245.07c23.31,6.26,47.11-6.92,53.17-29.45,6.06-22.53-7.93-45.87-31.23-52.14-23.31-6.26-47.11,6.92-53.17,29.45-6.06,22.53,7.93,45.87,31.23,52.14Z"
			/>
		</svg>
	)
}

export { FlameSpinner }
