import { exportJWK, generateKeyPair, type JWK, type KeyLike } from "jose";
import { randomUUID } from "node:crypto";

interface SigningKey {
  kid: string;
  publicKey: KeyLike;
  privateKey: KeyLike;
  publicJwk: JWK;
}

// A real deployment persists keys and rotates them on a schedule, keeping the
// previous public key in the JWKS until every outstanding token expires. For
// this demo we generate one keypair at boot -- the rotation *mechanism*
// (kid-tagged tokens, JWKS lookup by kid) is what matters and is identical.
let activeKey: SigningKey | null = null;

export async function getActiveSigningKey(): Promise<SigningKey> {
  if (activeKey) return activeKey;
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  const kid = randomUUID();
  publicJwk.kid = kid;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  activeKey = { kid, publicKey, privateKey, publicJwk };
  return activeKey;
}

export async function getJwks(): Promise<{ keys: JWK[] }> {
  const key = await getActiveSigningKey();
  return { keys: [key.publicJwk] };
}
