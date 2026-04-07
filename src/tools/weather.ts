import type { JambonzTool, ToolSchema } from '../types.js';

export interface WeatherOptions {
  /** Temperature scale (default: 'celsius') */
  scale?: 'celsius' | 'fahrenheit';
}

const schema: ToolSchema = {
  name: 'get_weather',
  description: 'Get the current temperature, wind speed, and conditions for a given location.',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name or location, e.g. "San Francisco" or "Paris, France"',
      },
    },
    required: ['location'],
  },
};

/**
 * Create a weather lookup tool using the free Open-Meteo API.
 *
 * No API key required. Provides current temperature, wind speed,
 * and weather conditions for any location worldwide.
 */
export function createWeather(options?: WeatherOptions): JambonzTool {
  const scale = options?.scale ?? 'celsius';

  return {
    schema,
    async execute(args: Record<string, any>): Promise<string> {
      const location = args.location as string;

      /* geocode the location name */
      const geoRes = await fetch(
        'https://geocoding-api.open-meteo.com/v1/search'
        + `?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
      );
      if (!geoRes.ok) {
        throw new Error(`Geocoding API error: ${geoRes.status}`);
      }

      const geoData = await geoRes.json() as {
        results?: { latitude: number; longitude: number; name: string; country: string }[];
      };
      if (!geoData.results?.length) {
        return `Sorry, I could not find weather data for "${location}".`;
      }

      const { latitude, longitude, name, country } = geoData.results[0];

      /* fetch current weather */
      const wxRes = await fetch(
        'https://api.open-meteo.com/v1/forecast'
        + `?latitude=${latitude}&longitude=${longitude}`
        + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m'
        + `&temperature_unit=${scale}`
      );
      if (!wxRes.ok) {
        throw new Error(`Weather API error: ${wxRes.status}`);
      }

      const wx = await wxRes.json() as {
        current: {
          temperature_2m: number;
          relative_humidity_2m: number;
          apparent_temperature: number;
          weather_code: number;
          wind_speed_10m: number;
        };
      };

      const unit = scale === 'fahrenheit' ? '°F' : '°C';
      const { temperature_2m, apparent_temperature, relative_humidity_2m, weather_code, wind_speed_10m } = wx.current;
      const condition = weatherCodeToText(weather_code);

      return [
        `Current weather in ${name}, ${country}:`,
        `${condition}, ${temperature_2m}${unit} (feels like ${apparent_temperature}${unit}).`,
        `Wind: ${wind_speed_10m} km/h. Humidity: ${relative_humidity_2m}%.`,
      ].join(' ');
    },
  };
}

/** Map WMO weather codes to human-readable descriptions */
function weatherCodeToText(code: number): string {
  const descriptions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    85: 'Slight snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
  };
  return descriptions[code] ?? 'Unknown conditions';
}
