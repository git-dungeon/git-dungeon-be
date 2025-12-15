export interface SettingsProfileResponse {
  profile: SettingsProfile;
  connections: SettingsConnections;
}

import { tags } from 'typia';

export interface SettingsProfile {
  userId: string &
    tags.Format<'uuid'> &
    tags.Example<'00000000-0000-4000-8000-000000000001'>;
  username: string & tags.Example<'mock-user'>;
  displayName: string & tags.Example<'Mock User'>;
  avatarUrl: string &
    tags.Format<'uri'> &
    tags.Example<'https://example.com/avatar.png'>;
  email: string & tags.Format<'email'> & tags.Example<'mock@example.com'>;
  joinedAt: string &
    tags.Format<'date-time'> &
    tags.Example<'2023-11-02T12:00:00.000Z'>;
}

export interface SettingsConnections {
  github: GithubConnectionStatus;
}

export interface GithubConnectionStatus {
  connected: boolean & tags.Example<true>;
  lastSyncAt:
    | (string &
        tags.Format<'date-time'> &
        tags.Example<'2025-10-17T01:15:00.000Z'>)
    | null;
}
