import type { JambonzTool, ToolSchema } from '../types.js';

export interface DateTimeOptions {
  /** Default timezone when none is specified (default: 'UTC') */
  defaultTimezone?: string;
}

const schema: ToolSchema = {
  name: 'get_datetime',
  description: 'Get the current date and time, optionally for a specific timezone. '
    + 'Useful for answering "what time is it?" or "what is the date in Tokyo?"',
  parameters: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description:
          'IANA timezone name, e.g. "America/New_York", "Europe/London", "Asia/Tokyo". '
          + 'Omit for the default timezone.',
      },
    },
    required: [],
  },
};

/**
 * Create a date/time tool using the built-in Intl API.
 *
 * No API key required. Returns the current date, time, and timezone
 * for any IANA timezone. Handles common city-to-timezone mapping for
 * cases where the LLM sends a city name instead of an IANA zone.
 */
export function createDateTime(options?: DateTimeOptions): JambonzTool {
  const defaultTz = options?.defaultTimezone ?? 'UTC';

  return {
    schema,
    async execute(args: Record<string, any>): Promise<string> {
      const input = (args.timezone as string | undefined) ?? defaultTz;
      const tz = resolveTimezone(input);

      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short',
        }).format(now);

        return `Current date and time in ${tz}: ${formatted}`;
      } catch {
        return `Unknown timezone: "${input}". Please use an IANA timezone like "America/New_York" or "Asia/Tokyo".`;
      }
    },
  };
}

/**
 * Best-effort mapping from common city names to IANA timezones.
 * The LLM will usually send proper IANA names, but voice users
 * often say "what time is it in London?" and the LLM may forward that.
 */
const CITY_MAP: Record<string, string> = {
  'new york': 'America/New_York',
  'nyc': 'America/New_York',
  'los angeles': 'America/Los_Angeles',
  'la': 'America/Los_Angeles',
  'chicago': 'America/Chicago',
  'denver': 'America/Denver',
  'london': 'Europe/London',
  'paris': 'Europe/Paris',
  'berlin': 'Europe/Berlin',
  'tokyo': 'Asia/Tokyo',
  'shanghai': 'Asia/Shanghai',
  'beijing': 'Asia/Shanghai',
  'mumbai': 'Asia/Kolkata',
  'delhi': 'Asia/Kolkata',
  'sydney': 'Australia/Sydney',
  'dubai': 'Asia/Dubai',
  'singapore': 'Asia/Singapore',
  'hong kong': 'Asia/Hong_Kong',
  'seoul': 'Asia/Seoul',
  'moscow': 'Europe/Moscow',
  'sao paulo': 'America/Sao_Paulo',
  'toronto': 'America/Toronto',
  'vancouver': 'America/Vancouver',
  'honolulu': 'Pacific/Honolulu',
  'anchorage': 'America/Anchorage',
};

function resolveTimezone(input: string): string {
  /* already looks like an IANA zone? */
  if (input.includes('/')) return input;
  /* check the city map */
  const lower = input.toLowerCase().trim();
  return CITY_MAP[lower] ?? input;
}
