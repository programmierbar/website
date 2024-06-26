// Basic Data Interfaces
export interface MemberOrSpeaker {
  first_name: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface PickOfTheDay {
  id: string;
  member?: MemberOrSpeaker;
  speaker?: MemberOrSpeaker;
  website_url: string;
  name: string;
  description: string;
}

export interface PodcastData {
  buzzsprout_id: number | string | undefined;
  published_on?: string;
  status?: string;
  type?: string;
  number?: number;
  title?: string;
  description?: string;
  picks_of_the_day?: PickOfTheDay[];
  cover_image?: string;
  audio_file?: string;
  tags?: Tag[];
}

// Payload Interface
export interface Payload extends PodcastData {
  name?: string;
  podcasts?: PodcastData[];
}

// Context, Logger, and ItemsService Interfaces
export interface Context {
  accountability: any;
  schema: any;
}

export interface Logger {
  info: (message: string) => void;
  error: (message: string) => void;
}

export interface ItemsService {
  readByQuery: (query: any) => Promise<PodcastData[]>;
  readOne: (id: string | number) => Promise<any>;
  updateOne: (id: string | number, data: any) => Promise<any>;
}

export interface Env {
  PUBLIC_URL: string;
  BUZZSPROUT_API_URL: string;
  BUZZSPROUT_API_TOKEN: string;
}

// Base Action Data Interface
export interface ActionData<T = Payload> {
  payload: T;
  context: Context;
}

export interface Dependencies {
  logger: Logger;
  ItemsService: new (collection: string, options: any) => ItemsService;
  env: Env;
}

// Buzzsprout Data Interface
export interface BuzzsproutData {
  id?: string;
  published_at?: string;
  private?: boolean;
  title?: string;
  custom_url?: string;
  description?: string;
  artwork_url?: string;
  audio_url?: string;
  tags?: string;
  explicit?: boolean;
  email_user_after_audio_processed?: boolean;
  episode_number?: number;
  season_number?: number;
  artist?: string;
}

export interface Metadata {
  collection: string;
  key?: string;
  keys?: string[];
}

export interface ActionData<T = Payload> {
  payload: T;
  context: Context;
  metadata: Metadata;
}

// Pick of the Day Interfaces
export interface PickOfTheDayPayload {
  name?: string;
  website_url?: string;
  description?: string;
  podcast?: string | number;
  member?: any;
  speaker?: any;
}
