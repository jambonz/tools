/**
 * JSON Schema for a tool's parameters, following the OpenAI function-calling format.
 */
export interface ToolParameters {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

/**
 * The schema definition passed to llmOptions.tools in a jambonz agent verb.
 * Compatible with OpenAI, Anthropic, Google, and Bedrock function-calling formats.
 */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: ToolParameters;
}

/**
 * Discovery metadata for a pre-built tool, describing it without having to
 * instantiate it (no API key required). Returned by `listTools()` so consumers
 * — IDEs, docs generators, AI coding agents — can enumerate what this version
 * of the package offers and how to use each tool.
 *
 * `name`, `description`, and `parameters` are derived from the tool's `schema`,
 * so they cannot drift from what the LLM actually sees.
 */
export interface ToolInfo {
  /** The tool name the LLM calls (matches the tool's `schema.name`). */
  name: string;
  /** What the tool does (matches the tool's `schema.description`). */
  description: string;
  /** The named factory export to import and call, e.g. `'createWikipedia'`. */
  factory: string;
  /** Whether the factory requires an API key in its options. */
  requiresApiKey: boolean;
  /** The JSON-schema parameters block the LLM fills in (the tool's `schema.parameters`). */
  parameters: ToolParameters;
}

/**
 * Per-tool metadata that cannot be derived from the schema. Each tool module
 * exports a `meta` of this shape; the generated catalog collects them.
 */
export interface ToolMeta {
  /** The named factory export to import and call, e.g. `'createWikipedia'`. */
  factory: string;
  /** Whether the factory requires an API key in its options. */
  requiresApiKey: boolean;
}

/**
 * A pre-built, reusable tool for jambonz agent voice AI apps.
 *
 * Each tool bundles:
 * - `schema` — the tool definition the LLM needs to know how to call it
 * - `execute` — the handler that runs when the LLM invokes the tool
 */
export interface JambonzTool {
  /** Tool schema for llmOptions.tools */
  schema: ToolSchema;
  /** Execute the tool and return a text result for the LLM */
  execute(args: Record<string, any>): Promise<string>;
}

/**
 * Minimal session interface — matches @jambonz/sdk WebSocket session
 * without requiring a hard dependency on the SDK.
 */
export interface SessionLike {
  on(event: string, handler: (evt: any) => void): void;
  sendToolOutput(toolCallId: string, data: unknown): void;
}
