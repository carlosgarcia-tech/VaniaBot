/**
 * WeatherService.ts
 *
 * VaniaBot services module exposing `WeatherService`, `weatherService`.
 *
 * @author **Carlos G**
 */

import axios from 'axios';
import { logError } from '@/utils/logger.js';

const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

interface WeatherResult {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
}

const WEATHER_CODES: Record<number, { description: string; emoji: string }> = {
  0: { description: 'Despejado', emoji: '☀️' },
  1: { description: 'Mayormente despejado', emoji: '🌤️' },
  2: { description: 'Parcialmente nublado', emoji: '⛅' },
  3: { description: 'Nublado', emoji: '☁️' },
  45: { description: 'Niebla', emoji: '🌫️' },
  48: { description: 'Niebla con escarcha', emoji: '🌫️' },
  51: { description: 'Llovizna ligera', emoji: '🌧️' },
  53: { description: 'Llovizna moderada', emoji: '🌧️' },
  55: { description: 'Llovizna densa', emoji: '🌧️' },
  61: { description: 'Lluvia ligera', emoji: '🌧️' },
  63: { description: 'Lluvia moderada', emoji: '🌧️' },
  65: { description: 'Lluvia intensa', emoji: '🌧️' },
  71: { description: 'Nieve ligera', emoji: '🌨️' },
  73: { description: 'Nieve moderada', emoji: '🌨️' },
  75: { description: 'Nieve intensa', emoji: '🌨️' },
  80: { description: 'Chubascos ligeros', emoji: '🌦️' },
  81: { description: 'Chubascos moderados', emoji: '🌦️' },
  82: { description: 'Chubascos violentos', emoji: '⛈️' },
  95: { description: 'Tormenta', emoji: '⛈️' },
  96: { description: 'Tormenta con granizo', emoji: '⛈️' },
  99: { description: 'Tormenta severa', emoji: '⛈️' },
};

export class WeatherService {
  private static instance: WeatherService;
  private readonly WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

  static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  async searchCity(name: string): Promise<GeoResult[]> {
    try {
      const response = await axios.get(GEO_API, {
        params: { name, count: 5, language: 'es', format: 'json' },
        timeout: 5000,
      });
      return response.data.results ?? [];
    } catch (error) {
      logError('WeatherService.searchCity', error);
      return [];
    }
  }

  async getWeather(lat: number, lon: number): Promise<WeatherResult | null> {
    try {
      const response = await axios.get(this.WEATHER_API, {
        params: {
          latitude: lat,
          longitude: lon,
          current:
            'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
          timezone: 'auto',
        },
        timeout: 5000,
      });

      const current = response.data.current;
      return {
        temperature: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        weatherCode: current.weather_code,
        isDay: current.is_day === 1,
      };
    } catch (error) {
      logError('WeatherService.getWeather', error);
      return null;
    }
  }

  getWeatherInfo(code: number): { description: string; emoji: string } {
    return WEATHER_CODES[code] ?? { description: 'Desconocido', emoji: '❓' };
  }
}

export const weatherService = WeatherService.getInstance();
