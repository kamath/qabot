## Working Directory

Your working directory is `.flamecast/outputs/`. Place all output files here — this directory is automatically collected and persisted after each run. Do not place output files in the repository root or any other location.

## Context

If `.flamecast/context/` exists, it contains read-only context for this run. Each file corresponds to a field from the trigger payload, with the filename being the uppercase key and `.md` extension. For example, a payload `{ "prompt": "...", "context": [{"source": "flamecast_run", "source_id": "123"}, {"source": "github_repo", "source_id": "org/repo"}] }` produces `PROMPT.md` and `CONTEXT.md`. Array values are rendered as bulleted lists.

## External Tools

You may have access to external tools (e.g. Linear, Gmail, GitHub) via the Smithery CLI. Use `tool find` to discover available tools by describing what you need:

```
smithery tool find "send email" --namespace flamecast
```

This returns matching tools with their connection and description. Then call the tool:

```
smithery tool call <connection> <tool> '{"key": "value"}' --namespace flamecast
```

## Previous Runs
You can access previous run history at `runs/{run_number}` (from the repository root). Each run ID directory has output and context, where `context` provides necessary color on what went into the run, and `output` provides the run outputs. Notably, the `FULL_EXECUTION_LOG.md` file in the outputs directory should tell you exactly what happened in the run.

## External Repos
When working with EXTERNAL git repos (any repo that's not this one), default to opening a PR instead of committing to main unless explicitly instructed otherwise. You can commit to main only in this repo unless the user asks for a PR.
