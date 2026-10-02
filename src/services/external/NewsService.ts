/**
 * NewsService.ts
 *
 * VaniaBot services module exposing `NewsService`, `newsService`.
 *
 * @author **Carlos G**
 */

import axios from 'axios';
import { logError } from '@/utils/logger.js';
import { env } from '@/config/env.js';

interface NewsArticle {
  title: string;
  description: string | null;
  url: string;
  source: string;
  publishedAt: string;
}

export class NewsService {
  private static instance: NewsService;
  private readonly NEWS_API = 'https://newsdata.io/api/1/news';
  private readonly API_KEY = env.NEWSDATA_API_KEY;

  static getInstance(): NewsService {
    if (!NewsService.instance) {
      NewsService.instance = new NewsService();
    }
    return NewsService.instance;
  }

  async getTopHeadlines(category?: string, country: string = 'mx'): Promise<NewsArticle[]> {
    if (!this.API_KEY) {
      return this.getMockNews();
    }

    try {
      const params: Record<string, string> = {
        apikey: this.API_KEY,
        country,
        language: 'es',
        size: '5',
      };

      if (category) {
        params.category = category;
      }

      const response = await axios.get(this.NEWS_API, { params, timeout: 8000 });
      const results = response.data.results ?? [];

      return results.slice(0, 5).map((item: Record<string, unknown>) => ({
        title: String(item.title ?? 'Sin título'),
        description: item.description ? String(item.description).slice(0, 200) : null,
        url: String(item.link ?? ''),
        source: String(item.source_id ?? 'Desconocido'),
        publishedAt: this.formatDate(String(item.pubDate ?? '')),
      }));
    } catch (error) {
      logError('NewsService.getTopHeadlines', error);
      return this.getMockNews();
    }
  }

  async searchNews(query: string): Promise<NewsArticle[]> {
    if (!this.API_KEY) {
      return this.getMockNews();
    }

    try {
      const response = await axios.get(this.NEWS_API, {
        params: {
          apikey: this.API_KEY,
          q: query,
          language: 'es',
          size: '5',
        },
        timeout: 8000,
      });

      const results = response.data.results ?? [];

      return results.slice(0, 5).map((item: Record<string, unknown>) => ({
        title: String(item.title ?? 'Sin título'),
        description: item.description ? String(item.description).slice(0, 200) : null,
        url: String(item.link ?? ''),
        source: String(item.source_id ?? 'Desconocido'),
        publishedAt: this.formatDate(String(item.pubDate ?? '')),
      }));
    } catch (error) {
      logError('NewsService.searchNews', error);
      return this.getMockNews();
    }
  }

  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  }

  private getMockNews(): NewsArticle[] {
    return [
      {
        title: 'Noticias no disponibles',
        description:
          'API KEY no establecida, esta función se encuentra temporalmente inhabilitada hasta que se agregue una api key funcional',
        url: '',
        source: 'Sistema',
        publishedAt: '',
      },
    ];
  }
}

export const newsService = NewsService.getInstance();
