import { Hono } from "hono"
import { z } from "zod"
import { validator as zValidator } from "hono-openapi"
import { AgentMailClient } from "agentmail"
import { authMiddleware, type AuthEnv } from "../lib/middleware"

const AttachmentSchema = z.object({
	content: z.string(),
	filename: z.string(),
	contentType: z.string(),
})

const SendEmailRequestSchema = z.object({
	subject: z.string().min(1),
	text: z.string().min(1),
	attachments: z.array(AttachmentSchema).optional(),
})

const email = new Hono<AuthEnv>()
email.use(authMiddleware)

// POST / — Send an email to the authenticated user
email.post("/", zValidator("json", SendEmailRequestSchema), async c => {
	const workos = c.get("workos")
	const authRow = c.get("authRow")
	const { subject, text, attachments } = c.req.valid("json")

	const user = await workos.userManagement.getUser(authRow.userId)
	if (!user?.email) {
		return c.json({ error: "User email not found" }, 400)
	}

	const client = new AgentMailClient({ apiKey: c.env.AGENTMAIL_API_KEY })
	const inboxId = c.env.AGENTMAIL_INBOX_ID

	try {
		const sentMessage = await client.inboxes.messages.send(inboxId, {
			to: [user.email],
			subject,
			text,
			attachments: attachments?.map(a => ({
				content: a.content,
				filename: a.filename,
				contentType: a.contentType,
			})),
		})

		return c.json({ success: true, messageId: sentMessage.messageId })
	} catch {
		return c.json({ error: "Failed to send email" }, 500)
	}
})

export default email
