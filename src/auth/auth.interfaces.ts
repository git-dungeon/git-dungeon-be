export interface GitHubAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

export interface AuthConfig {
  github: GitHubAuthConfig;
}

export interface GitHubPopupAuthRequest {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
  deviceId?: string;
  user?: string;
}

export interface GitHubPopupSession {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface GitHubPopupAuthResponse {
  redirect: string;
  session: GitHubPopupSession;
  accessToken: string;
}
