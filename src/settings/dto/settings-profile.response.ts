export interface SettingsProfileResponse {
  profile: SettingsProfile;
  connections: SettingsConnections;
}

export interface SettingsProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  email: string;
  joinedAt: string;
}

export interface SettingsConnections {
  github: GithubConnectionStatus;
}

export interface GithubConnectionStatus {
  connected: boolean;
  lastSyncAt: string | null;
}
