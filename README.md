# @jambonz/tools

Pre-built, reusable tools for jambonz pipeline voice AI agents.

Instead of copy-pasting tool schemas and writing API handlers for every application, import a ready-made tool and wire it up in a few lines:

```typescript
import { createTavilySearch, registerTools } from '@jambonz/tools';

const search = createTavilySearch({ apiKey: 'tvly-xxx' });

session.pipeline({
  llm: {
    vendor: 'openai',
    model: 'gpt-4.1-mini',
    llmOptions: {
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      tools: [search.schema],
    },
  },
  toolHook: '/tool-call',
  // ...stt, tts, etc.
}).send();

registerTools(session, '/tool-call', [search]);
```

That's it. The schema tells the LLM what the tool does, `registerTools` handles dispatch and execution.

## Install

```bash
npm install @jambonz/tools
```

## Concepts

### How tools work in jambonz pipeline

When you give an LLM tools in a jambonz pipeline, the flow is:

1. The LLM decides to call a tool and sends a `tool_call` with a name and arguments
2. The feature-server routes it to your application via the `toolHook` path
3. Your application executes the tool and sends the result back via `session.sendToolOutput()`
4. The LLM incorporates the result into its response

This package handles step 3 for you — each tool bundles a pre-built `execute()` function that calls the right API, parses the result, and returns a text string the LLM can use.

### The JambonzTool interface

Every tool in this package implements:

```typescript
interface JambonzTool {
  schema: ToolSchema;                                   // what the LLM sees
  execute(args: Record<string, any>): Promise<string>;  // what runs when the LLM calls it
}
```

You can use these two pieces independently:
- Pass `tool.schema` to `llmOptions.tools` in your pipeline verb
- Call `tool.execute(args)` yourself in a custom toolHook handler
- Or use `registerTools()` to wire everything up automatically

### registerTools()

`registerTools()` is a convenience that listens on a session's toolHook path and dispatches to the right tool:

```typescript
registerTools(session, '/tool-call', [search, weather, calculator], {
  logger: log,  // optional pino logger — logs tool calls and errors
});
```

It handles:
- Matching the tool name from the LLM's request to the right handler
- Calling `execute()` with the parsed arguments
- Sending the result back via `session.sendToolOutput()`
- Error handling — if a tool throws, the error message is sent back to the LLM
- Unknown tools — if the LLM calls a tool that isn't registered, an error is returned

## Available tools

### Web Search (Tavily)

Search the web for current information. Requires a [Tavily API key](https://tavily.com).

```typescript
import { createTavilySearch } from '@jambonz/tools';

const search = createTavilySearch({
  apiKey: 'tvly-xxx',          // required
  maxResults: 3,               // default: 3
  searchDepth: 'basic',        // 'basic' | 'advanced' (default: 'basic')
  topic: 'general',            // 'general' | 'news' | 'finance' (default: 'general')
  includeDomains: ['cnn.com'], // optional: only search these domains
  excludeDomains: ['x.com'],   // optional: never include these domains
});
```

**Tool name:** `web_search`
**Parameters the LLM sends:** `{ query: "latest news about..." }`

### Weather (Open-Meteo)

Current weather for any location worldwide. **No API key required.**

```typescript
import { createWeather } from '@jambonz/tools';

const weather = createWeather({
  scale: 'fahrenheit',  // 'celsius' | 'fahrenheit' (default: 'celsius')
});
```

**Tool name:** `get_weather`
**Parameters the LLM sends:** `{ location: "San Francisco" }`
**Returns:** Temperature, feels-like, wind speed, humidity, and conditions.

### Wikipedia

Factual summaries from Wikipedia. **No API key required.**

```typescript
import { createWikipedia } from '@jambonz/tools';

const wiki = createWikipedia({
  maxSentences: 5,   // default: 5
  language: 'en',    // Wikipedia language edition (default: 'en')
});
```

**Tool name:** `wikipedia`
**Parameters the LLM sends:** `{ query: "Eiffel Tower" }`
**Returns:** Article title and summary text.

### Calculator

Safe math expression evaluator. **No API key required.**

```typescript
import { createCalculator } from '@jambonz/tools';

const calc = createCalculator();
```

**Tool name:** `calculator`
**Parameters the LLM sends:** `{ expression: "87.50 * 0.15" }`
**Supports:** `+`, `-`, `*`, `/`, `^` (power), `%` (modulo), parentheses, and functions: `sqrt`, `abs`, `round`, `ceil`, `floor`, `sin`, `cos`, `tan`, `log`, `log10`, `exp`. Constants: `pi`, `e`.

Uses a safe recursive descent parser — no `eval()`.

### Date & Time

Current date and time for any timezone. **No API key required.**

```typescript
import { createDateTime } from '@jambonz/tools';

const datetime = createDateTime({
  defaultTimezone: 'America/New_York',  // default: 'UTC'
});
```

**Tool name:** `get_datetime`
**Parameters the LLM sends:** `{ timezone: "Asia/Tokyo" }` (optional — uses default if omitted)
**Returns:** Formatted date, time, and timezone. Handles common city names ("London", "Tokyo") in addition to IANA zones.

## Full example

A voice agent with web search, weather, and a calculator:

```typescript
import * as http from 'node:http';
import pino from 'pino';
import { createEndpoint } from '@jambonz/sdk/websocket';
import {
  createTavilySearch,
  createWeather,
  createCalculator,
  registerTools,
} from '@jambonz/tools';

const logger = pino({ level: 'info' });
const port = parseInt(process.env.PORT || '3000', 10);
const server = http.createServer();
const makeService = createEndpoint({ server, port });

const search = createTavilySearch({ apiKey: process.env.TAVILY_API_KEY! });
const weather = createWeather({ scale: 'fahrenheit' });
const calc = createCalculator();
const tools = [search, weather, calc];

const svc = makeService({ path: '/' });
svc.on('session:new', (session) => {
  const log = logger.child({ call_sid: session.callSid });

  session.on('/pipeline-complete', () => {
    session.hangup().reply();
  });

  registerTools(session, '/tool-call', tools, { logger: log });

  session
    .pipeline({
      stt: { vendor: 'deepgram', language: 'multi' },
      tts: { vendor: 'cartesia', voice: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc' },
      llm: {
        vendor: 'openai',
        model: 'gpt-4.1-mini',
        llmOptions: {
          messages: [
            {
              role: 'system',
              content: [
                'You are a helpful voice assistant with access to web search, weather, and a calculator.',
                'Use the appropriate tool when the user asks about current events, weather, or math.',
                'Keep responses concise and conversational.',
              ].join(' '),
            },
          ],
          tools: tools.map((t) => t.schema),
        },
      },
      toolHook: '/tool-call',
      bargeIn: { enable: true },
      turnDetection: 'krisp',
      actionHook: '/pipeline-complete',
    })
    .send();
});

logger.info({ port }, 'listening');
```

## Mixing with custom tools and MCP

`@jambonz/tools` works alongside your own custom tools and MCP servers. Just include whatever you need:

```typescript
// your custom tool
const myTool = {
  name: 'lookup_order',
  description: 'Look up an order by ID',
  parameters: { type: 'object', properties: { order_id: { type: 'string' } }, required: ['order_id'] },
};

session.pipeline({
  llm: {
    llmOptions: {
      tools: [
        search.schema,           // from @jambonz/tools
        weather.schema,          // from @jambonz/tools
        myTool,                  // your custom schema
      ],
    },
  },
  mcpServers: [                  // MCP tools discovered automatically
    { url: 'https://mcp.example.com/sse' },
  ],
  toolHook: '/tool-call',
});

// register the pre-built tools
registerTools(session, '/tool-call', [search, weather], { logger: log });

// handle your custom tool separately
session.on('/tool-call', async (evt) => {
  if (evt.name === 'lookup_order') {
    const result = await db.orders.find(evt.arguments.order_id);
    session.sendToolOutput(evt.tool_call_id, JSON.stringify(result));
  }
});
```

> **Note:** MCP tools are handled by the feature-server directly — they don't arrive on your toolHook. Only inline tools (from `llmOptions.tools`) route to your application.

## Using with dynamic tools

You can inject `@jambonz/tools` tools mid-conversation using `updatePipeline()`:

```typescript
// start without tools, then add them after a few turns
session.updatePipeline({
  type: 'update_tools',
  tools: [search.schema, weather.schema],
});
```

## Contributing a new tool

Adding a tool to this package:

1. Create `src/tools/your-tool.ts`
2. Export a factory function: `createYourTool(options?): JambonzTool`
3. The factory returns `{ schema, execute }`
4. Add the export to `src/index.ts`
5. Add documentation to this README

### Guidelines

- **Keep it simple** — a tool is a schema + an async function that returns a string. No classes, no inheritance.
- **Prefer free APIs** — tools that work without API keys have a lower barrier to entry. If an API key is required, make it the only required option.
- **Return text, not JSON** — the LLM reads the result as part of a conversation. Format output as natural language, not raw JSON.
- **Handle errors gracefully** — return a helpful message rather than throwing when possible (e.g., "No results found" rather than crashing).
- **Think voice-first** — the result will be spoken aloud. Avoid markdown, URLs, or formatting that sounds awkward when read by TTS.

## License

MIT