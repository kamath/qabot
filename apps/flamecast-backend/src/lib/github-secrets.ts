export function encryptSecret(value: string, publicKeyBase64: string): string {
	const nacl = require("tweetnacl") as typeof import("tweetnacl")
	const blake2b = require("blakejs").blake2b as typeof import("blakejs").blake2b

	const recipientPk = Buffer.from(publicKeyBase64, "base64")
	const message = Buffer.from(value, "utf8")

	const ephemeralKp = nacl.box.keyPair()

	const nonceInput = Buffer.concat([
		Buffer.from(ephemeralKp.publicKey),
		recipientPk,
	])
	const nonce = blake2b(nonceInput, undefined, 24)

	const encrypted = nacl.box(
		message,
		nonce,
		new Uint8Array(recipientPk),
		ephemeralKp.secretKey,
	)
	if (!encrypted) throw new Error("Encryption failed")

	const sealed = Buffer.concat([
		Buffer.from(ephemeralKp.publicKey),
		Buffer.from(encrypted),
	])
	return sealed.toString("base64")
}
