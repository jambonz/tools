import type { JambonzTool, ToolSchema } from '../types.js';

export interface WikipediaOptions {
  /** Maximum number of sentences to return from the article summary (default: 5) */
  maxSentences?: number;
  /** Wikipedia language edition (default: 'en') */
  language?: string;
}

const schema: ToolSchema = {
  name: 'wikipedia',
  description: 'Look up a topic on Wikipedia to get a factual summary. '
    + 'Useful for answering questions about people, places, history, science, and general knowledge.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The topic to look up on Wikipedia',
      },
    },
    required: ['query'],
  },
};

/**
 * Create a Wikipedia lookup tool using the free Wikipedia REST API.
 *
 * No API key required. Searches Wikipedia and returns article summaries,
 * ideal for answering general knowledge questions in voice conversations.
 */
export function createWikipedia(options?: WikipediaOptions): JambonzTool {
  const maxSentences = options?.maxSentences ?? 5;
  const lang = options?.language ?? 'en';

  return {
    schema,
    async execute(args: Record<string, any>): Promise<string> {
      const query = args.query as string;

      /* search for matching articles */
      const searchRes = await fetch(
        `https://${lang}.wikipedia.org/w/api.php`
        + `?action=query&list=search&srsearch=${encodeURIComponent(query)}`
        + '&srlimit=1&format=json&origin=*'
      );
      if (!searchRes.ok) {
        throw new Error(`Wikipedia search error: ${searchRes.status}`);
      }

      const searchData = await searchRes.json() as {
        query: { search: { title: string; pageid: number }[] };
      };
      if (!searchData.query.search.length) {
        return `No Wikipedia article found for "${query}".`;
      }

      const { title } = searchData.query.search[0];

      /* fetch the article summary */
      const summaryRes = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
      );
      if (!summaryRes.ok) {
        throw new Error(`Wikipedia summary error: ${summaryRes.status}`);
      }

      const summary = await summaryRes.json() as {
        title: string;
        extract: string;
      };

      /* trim to maxSentences */
      const sentences = summary.extract.split(/(?<=\.)\s+/);
      const trimmed = sentences.slice(0, maxSentences).join(' ');

      return `${summary.title}: ${trimmed}`;
    },
  };
}
