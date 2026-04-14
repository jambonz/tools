# AGENTS.md

This file provides guidance to AI coding agents working with code in this repository.

## What this is

`@jambonz/tools` — a library of pre-built, reusable tools for jambonz agent voice AI applications. Each tool is a `{ schema, execute }` pair: the schema tells the LLM what it can call, `execute` handles the API call and returns a text string. The `registerTools()` helper wires tools onto a jambonz WebSocket session automatically.

## Commands

- **Build:** `npm run build` (uses tsup, outputs ESM + CJS + .d.ts to `dist/`)
- **Lint:** `npm run lint`
- **Lint + fix:** `npm run lint:fix`
- No test suite exists yet.

## Pre-commit hook

Husky runs `lint-staged` on commit, which runs `eslint --max-warnings 0` on staged `.ts` files.

## Architecture

All source is in `src/`, TypeScript, ES modules.

- `src/types.ts` — Core interfaces: `JambonzTool`, `ToolSchema`, `SessionLike`. `SessionLike` is a minimal duck-type of the `@jambonz/sdk` WebSocket session (no hard dependency).
- `src/register.ts` — `registerTools()` dispatcher: listens on a session hook path, maps tool names to handlers, calls `execute()`, sends results back via `session.sendToolOutput()`.
- `src/tools/*.ts` — Each file exports a factory function (`createXxx(options?) → JambonzTool`). Tools are stateless closures, not classes.
- `src/index.ts` — Re-exports everything. All new tools must be added here.

### Adding a new tool

1. Create `src/tools/your-tool.ts` exporting `createYourTool(options?): JambonzTool`
2. Return `{ schema, execute }` — schema follows OpenAI function-calling format
3. Re-export from `src/index.ts`

### Design constraints

- **Return text, not JSON** — results are spoken aloud by TTS. Format as natural language.
- **Prefer free APIs** — if an API key is required, make it the only required option.
- **No eval()** — the calculator uses a recursive descent parser for safe expression evaluation.

## Style

- 2-space indent, single quotes, semicolons, max line length 120
- `prefer-const`, arrow parens always required
- `@typescript-eslint/no-explicit-any` is off
- Promise plugin enforced (always-return, catch-or-return)
