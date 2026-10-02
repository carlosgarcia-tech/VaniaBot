declare module 'yt-search' {
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

  export interface SearchResult {
    videos: VideoSearchResult[];
    playlists: Playlist[];
    channels: Channel[];
    live: LiveStream[];
  }

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
