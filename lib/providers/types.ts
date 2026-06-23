export interface AnimeCard {
  title: string;
  slug: string;
  thumbnail: string;
  score?: string;
  status: "ongoing" | "completed";
  latestEpisode?: string;
  genres?: string[];
}

export interface EpisodeMeta {
  title: string;
  slug: string;
  date: string;
}

export interface AnimeDetail {
  title: string;
  titleJp?: string;
  slug: string;
  thumbnail: string;
  score?: string;
  status: "ongoing" | "completed";
  synopsis: string;
  studio?: string;
  type?: string;
  totalEpisodes?: string;
  duration?: string;
  releaseDate?: string;
  genres: string[];
  episodes: EpisodeMeta[];
}

export interface Mirror {
  quality: string;
  index: number;
  label: string;
  id: number;
}

export interface EpisodeDetail {
  title: string;
  animeTitle: string;
  animeSlug: string;
  mirrors: Mirror[];
  prevSlug?: string;
  nextSlug?: string;
}

export interface ScheduleEntry {
  title: string;
  slug: string;
}

export interface WeeklySchedule {
  [day: string]: ScheduleEntry[];
}

export interface Genre {
  name: string;
  slug: string;
  count?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  totalPages: number;
  currentPage: number;
}

export interface AnimeProvider {
  getOngoing(page?: number): Promise<PaginatedResult<AnimeCard>>;
  getComplete(page?: number): Promise<PaginatedResult<AnimeCard>>;
  getSchedule(): Promise<WeeklySchedule>;
  getGenres(): Promise<Genre[]>;
  getByGenre(genre: string, page?: number): Promise<PaginatedResult<AnimeCard>>;
  getAnimeDetail(slug: string): Promise<AnimeDetail>;
  getEpisode(slug: string): Promise<EpisodeDetail>;
  getEmbedUrl(id: number, mirror: number, quality: string): Promise<string>;
  search(query: string): Promise<AnimeCard[]>;
}
