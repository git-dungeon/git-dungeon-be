export interface GitHubAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

export interface AuthConfig {
  github: GitHubAuthConfig;
}
