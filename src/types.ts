export interface UserProfile {
  username: string;
  department: string;
  userId: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  spotifyUri: string;
  requestedBy: string;
  votes: number;
  upvoters: string[];
  downvoters: string[];
  status?: 'requested' | 'priority' | 'queued';
  voters?: {
    up: { username: string; department: string }[];
    down: { username: string; department: string }[];
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  uri: string;
}

export interface PlaybackState {
  item: {
    name: string;
    artists: string[];
    albumArt: string;
    duration_ms: number;
    uri: string;
  };
  progress_ms: number;
  is_playing: boolean;
  voterInfo: {
    requestedBy: string;
    votes: number;
    voters: {
      up: { username: string; department: string }[];
      down: { username: string; department: string }[];
    };
  } | null;
}
