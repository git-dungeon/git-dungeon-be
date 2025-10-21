export interface GitHubAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

export interface AuthRedirectConfig {
  allowedOrigins: string[];
}

export interface AuthConfig {
  github: GitHubAuthConfig;
  redirect: AuthRedirectConfig;
  publicBaseUrl: string;
}
