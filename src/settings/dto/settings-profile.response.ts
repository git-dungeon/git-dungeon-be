export interface SettingsProfileResponse {
  profile: SettingsProfile;
  connections: SettingsConnections;
}

export interface SettingsProfile {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  joinedAt: string;
}

export interface SettingsConnections {
  github: GithubConnectionStatus;
}

export interface GithubConnectionStatus {
  connected: boolean;
  lastSyncAt: string | null;
}
