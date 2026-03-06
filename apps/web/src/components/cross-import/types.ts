// Shared types for cross-import components

export interface MatchResult {
  sourceTrack: { title: string; artist: string; album?: string };
  targetTrackId?: string;
  targetTitle?: string;
  targetArtist?: string;
  targetAlbum?: string;
  confidence: number;
  matched: boolean;
  skipped: boolean;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
