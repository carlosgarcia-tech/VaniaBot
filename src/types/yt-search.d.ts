/**
 * yt-search.d.ts
 *
 * Ambient types for the YouTube search helper.
 *
 * The module exposes an overloaded `search` that behaves differently depending
 * on its argument: a text query returns mixed results, while a `videoId` returns
 * the metadata for a single video. The overloads below mirror that.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

declare module 'yt-search' {
  /** A video as returned by a text search. */
  export interface VideoSearchResult {
    videoId: string;
    title: string;
    url: string;
    thumbnail: string;
    duration: {
      seconds: number;
      timestamp: string;
    };
    timestamp: string;
    views: number;
    author: {
      name: string;
      url: string;
    };
    ago: string;
    description: string;
  }

  /** Mixed result set from a text query. */
  export interface SearchResult {
    videos: VideoSearchResult[];
    playlists: Playlist[];
    channels: Channel[];
    live: LiveStream[];
  }

  /** Metadata for a single video, returned when searching by videoId. */
  export interface VideoResult {
    videoId: string;
    title: string;
    url: string;
    thumbnail: string;
    duration: {
      seconds: number;
      timestamp: string;
    };
    timestamp: string;
    views: number;
    author: {
      name: string;
      url: string;
    };
    description: string;
  }

  /** Search input; either `query` or `videoId` drives the lookup. */
  export interface SearchOptions {
    query?: string;
    videoId?: string;
    pages?: number;
  }

  function search(options: SearchOptions): Promise<SearchResult>;
  function search(query: string): Promise<SearchResult>;
  function search(options: { videoId: string }): Promise<VideoResult>;

  export default search;
}
