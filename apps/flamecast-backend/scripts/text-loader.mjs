/**
 * Registers a custom Node.js ESM loader that handles .yml and .md files as
 * text modules, matching wrangler's Text rule behavior for non-wrangler
 * contexts (e.g. the openapi:generate script).
 *
 * Usage: node --import ./scripts/text-loader.mjs ...
 */
import { register } from "node:module"

register("./text-loader-hooks.mjs", import.meta.url)
