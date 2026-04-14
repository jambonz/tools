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
