// Decodes the access token's payload without verifying the signature. This
// mirrors the "local" half of the writeup's check: reading a permission
// straight out of the token, no network call. Verification of the signature
// still only ever happens once, server-side, at issuance and on every
// request that hits the backend -- the client trusts the token it was just
// handed over an authenticated HTTPS connection.
export interface AccessTokenClaims {
  sub: string;
  tenant_id: string;
  roles: string[];
  permissions: string[];
  pv: number;
  exp: number;
}

export function decodeAccessToken(token: string): AccessTokenClaims {
  const [, payload] = token.split(".");
  if (!payload) throw new Error("malformed token");
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json);
}
