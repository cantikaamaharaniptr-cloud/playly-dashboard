// Type definitions untuk videos table.

export type VideoVisibility = 'public' | 'unlisted' | 'private';

export type Video = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  visibility: VideoVisibility;
  storage_path: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  thumbnail_url: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export type VideoInsert = Pick<
  Video,
  'owner_id' | 'title' | 'description' | 'category' | 'visibility' | 'storage_path'
> &
  Partial<Pick<Video, 'duration_seconds' | 'file_size_bytes' | 'mime_type'>>;
