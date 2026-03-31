// ── Auth DTOs ────────────────────────────────────────────
export interface RegisterDto {
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface TokenResponseDto {
  accessToken: string;
  refreshToken: string;
}
