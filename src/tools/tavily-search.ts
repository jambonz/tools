import type { JambonzTool, ToolSchema } from '../types.js';

export interface TavilySearchOptions {
  /** Tavily API key (required) */
  apiKey: string;
  /** Maximum number of results to return (default: 3) */
  maxResults?: number;
  /** Search depth: 'basic' is faster, 'advanced' is more thorough (default: 'basic') */
  searchDepth?: 'basic' | 'advanced';
  /** Topic category (default: 'general') */
  topic?: 'general' | 'news' | 'finance';
  /** Only include results from these domains */
  includeDomains?: string[];
  /** Exclude results from these domains */
  excludeDomains?: string[];
}

const schema: ToolSchema = {
  name: 'web_search',
  description: 'Search the web for current information on a given topic or question.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
    },
    required: ['query'],
  },
};

/**
 * Create a web search tool powered by the Tavily Search API.
 *
 * Useful for answering questions about current events, recent news,
 * or any topic that requires up-to-date information.
 *
 * Requires a Tavily API key — sign up at https://tavily.com
 */
export function createTavilySearch(options: TavilySearchOptions): JambonzTool {
  const {
    apiKey,
    maxResults = 3,
    searchDepth = 'basic',
    topic = 'general',
    includeDomains,
    excludeDomains,
  } = options;

  return {
    schema,
    async execute(args: Record<string, any>): Promise<string> {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: args.query,
          max_results: maxResults,
          search_depth: searchDepth,
          topic,
          ...(includeDomains && { include_domains: includeDomains }),
          ...(excludeDomains && { exclude_domains: excludeDomains }),
        }),
      });

      if (!res.ok) {
        throw new Error(`Tavily API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json() as {
        results?: { title: string; content: string; url: string }[];
      };

      const results = (data.results || [])
        .map((r) => `${r.title}: ${r.content}`)
        .join('\n');

      return results || 'No results found.';
    },
  };
}
