function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`missing required env var ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL", "postgres://rbac:rbac@localhost:5432/rbac_demo"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 15 * 60),
  refreshTokenTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 30 * 24 * 60 * 60),
  serviceTokenTtlSeconds: Number(process.env.SERVICE_TOKEN_TTL_SECONDS ?? 10 * 60),
  issuer: process.env.TOKEN_ISSUER ?? "https://rbac-demo.local",
  userAudience: process.env.USER_AUDIENCE ?? "rbac-demo:user",
  serviceAudience: process.env.SERVICE_AUDIENCE ?? "rbac-demo:service",
};
