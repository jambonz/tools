import type { JambonzTool, SessionLike } from './types.js';

interface ToolCallEvent {
  tool_call_id: string;
  name: string;
  arguments: Record<string, any>;
}

/**
 * Register one or more tools on a jambonz session.
 *
 * Listens on the given hook path for tool-call events, dispatches to the
 * matching tool's execute() method, and sends the result back via
 * session.sendToolOutput(). Unknown tool names are reported as errors.
 *
 * @param session  - A jambonz WebSocket session (or any object with .on() and .sendToolOutput())
 * @param hookPath - The toolHook path used in the agent verb (e.g. '/tool-call')
 * @param tools    - Array of JambonzTool instances to register
 * @param options  - Optional configuration
 * @param options.logger - A pino-compatible logger for debug/error output
 * @param options.onUnknownTool - Custom handler for unrecognized tool names
 */
export function registerTools(
  session: SessionLike,
  hookPath: string,
  tools: JambonzTool[],
  options?: {
    logger?: { info: (...args: any[]) => void; error: (...args: any[]) => void };
    onUnknownTool?: (session: SessionLike, evt: ToolCallEvent) => void;
  }
): void {
  const toolMap = new Map(tools.map((t) => [t.schema.name, t]));
  const log = options?.logger;

  session.on(hookPath, async(evt: ToolCallEvent) => {
    const { tool_call_id, name, arguments: args } = evt;
    const tool = toolMap.get(name);

    if (!tool) {
      log?.error({ name, args }, `unknown tool: ${name}`);
      if (options?.onUnknownTool) {
        options.onUnknownTool(session, evt);
      } else {
        session.sendToolOutput(tool_call_id, `Unknown tool: ${name}`);
      }
      return;
    }

    log?.info({ name, args }, 'tool call');
    try {
      const result = await tool.execute(args);
      session.sendToolOutput(tool_call_id, result);
    } catch (err) {
      log?.error({ err, name, args }, `tool execution failed: ${name}`);
      session.sendToolOutput(tool_call_id, `Error executing ${name}: ${err}`);
    }
  });
}
