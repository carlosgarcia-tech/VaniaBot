/**
 * FallbackAPIService.ts
 *
 * VaniaBot services module exposing `FallbackAPIService`, `fallbackAPIService`.
 *
 * @author **Carlos G**
 */

import axios from 'axios';
import { logError } from '@/utils/logger.js';

const ANIME_FALLBACK = [
  '*Attack on Titan*\n📺 87+ episodios\n📝 Una humanidad lucha por sobrevivir contra titanes',
  '*Death Note*\n📺 37 episodios\n📝 Un estudiante encuentra un cuaderno mortal',
  '*Naruto*\n📺 220 episodios\n📝 La historia del ninja más persistente',
  '*One Piece*\n📺 1000+ episodios\n📝 Una tripulación busca el tesoro definitivo',
  '*Demon Slayer*\n📺 44+ episodios\n📝 Un joven combate demonios para salvar a su hermana',
];

const MOVIE_FALLBACK = [
  '*The Shawshank Redemption* (1994)\n📝 Una historia de esperanza y amistad en prisión',
  '*Inception* (2010)\n📝 Un robo dentro de sueños dentro de sueños',
  '*The Dark Knight* (2008)\n📝 Batman enfrenta su mayor desafío moral',
  '*Spirited Away* (2001)\n📝 Una aventura mágica en el mundo de los espíritus',
  '*Pulp Fiction* (1994)\n📝 Varias historias se cruzan de forma inolvidable',
];

const JOKE_FALLBACK = [
  '¿Qué le dijo un .exe a un .bat?\nEXE-cúsame, pero estoy en otra extensión',
  '¿Cómo se despiden los chemists?\nÁcido mieling',
  '¿Por qué los bookmarks nunca se estresan?\nPorque siempre tienen su lugar marcado',
  'Un optimista dice: El vaso está medio lleno\nUn pesimista dice: El vaso está medio vacío\nEl ingeniero dice: El vaso es el doble de grande de lo necesario',
  '¿Qué hace una abeja en el gym?\nZumba',
  '¿Cómo se dice pañuelo en japonés?\nSaka-moe',
];

export class FallbackAPIService {
  private static instance: FallbackAPIService;
  private malCache = new Map<string, { data: string; timestamp: number }>();
  private tmdbCache = new Map<string, { data: string; timestamp: number }>();
  private jokeCache: string[] = [];
  private jokeCacheTimestamp = 0;
  private readonly CACHE_TTL = 30 * 60 * 1000;
  private readonly MAL_API = 'https://api.jikan.moe/v4/top/anime';
  private readonly TMDB_API = 'https://api.themoviedb.org/3';

  static getInstance(): FallbackAPIService {
    if (!FallbackAPIService.instance) {
      FallbackAPIService.instance = new FallbackAPIService();
    }
    return FallbackAPIService.instance;
  }

  private getRandomFallback<T>(fallbacks: T[]): T {
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  async getAnimeRecommendation(genre?: string): Promise<string> {
    const cacheKey = genre?.toLowerCase() ?? 'top';
    const cached = this.malCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const response = await axios.get(this.MAL_API, {
        params: { limit: 10 },
        timeout: 5000,
      });

      const anime = response.data?.data;
      if (anime && anime.length > 0) {
        const pick = anime[Math.floor(Math.random() * Math.min(5, anime.length))];
        const result = `*${pick.title}*\n📺 ${pick.episodes ?? '?'} episodios\n📝 ${pick.synopsis?.slice(0, 150) ?? 'Sin descripción'}...`;
        this.malCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }
    } catch (error) {
      logError('FallbackAPIService.getAnimeRecommendation', error);
    }

    return this.getRandomFallback(ANIME_FALLBACK);
  }

  async getMovieRecommendation(_genre?: string): Promise<string> {
    const tmdbKey = process.env.TMDB_API_KEY;

    if (!tmdbKey) {
      return this.getRandomFallback(MOVIE_FALLBACK);
    }

    try {
      const response = await axios.get(`${this.TMDB_API}/movie/popular`, {
        params: { api_key: tmdbKey, language: 'es-MX' },
        timeout: 5000,
      });

      const movies = response.data?.results;
      if (movies && movies.length > 0) {
        const pick = movies[Math.floor(Math.random() * Math.min(5, movies.length))];
        const result = `*${pick.title}* (${pick.release_date?.slice(0, 4) ?? '?'})\n📝 ${pick.overview?.slice(0, 150) ?? 'Sin descripción'}...`;
        return result;
      }
    } catch (error) {
      logError('FallbackAPIService.getMovieRecommendation', error);
    }

    return this.getRandomFallback(MOVIE_FALLBACK);
  }

  async getJoke(_type: 'short' | 'long' = 'short'): Promise<string> {
    if (Date.now() - this.jokeCacheTimestamp > this.CACHE_TTL || this.jokeCache.length === 0) {
      try {
        const response = await axios.get('https://api.jokes.one/joke', {
          params: { category: 'misc' },
          timeout: 5000,
        });
        const joke = response.data?.contents?.jokes?.[0]?.joke?.text;
        if (joke) {
          this.jokeCache = joke.split('\n');
          this.jokeCacheTimestamp = Date.now();
        }
      } catch (error) {
        logError('FallbackAPIService.getJoke', error);
      }
    }

    if (this.jokeCache.length > 0) {
      return this.jokeCache.join('\n');
    }

    return this.getRandomFallback(JOKE_FALLBACK);
  }
}

export const fallbackAPIService = FallbackAPIService.getInstance();
