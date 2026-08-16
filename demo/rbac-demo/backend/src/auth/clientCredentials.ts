import { pool } from "../lib/db.js";
import { verifyPassword } from "../lib/password.js";
import { getServiceClientByClientId, listScopesForServiceClient } from "../repo/serviceClients.js";
import { signServiceToken } from "./tokens.js";
import { AuthError } from "./service.js";

// Client credentials grant: a Flexday service or a client integration
// authenticates as itself, not as a user, and gets back a token scoped to
// permission strings drawn from the same vocabulary roles are built from.
export async function issueServiceToken(clientId: string, clientSecret: string): Promise<string> {
  const client = await getServiceClientByClientId(pool, clientId);
  if (!client) throw new AuthError("invalid client credentials");

  const validSecret = await verifyPassword(clientSecret, client.secret_hash);
  if (!validSecret) throw new AuthError("invalid client credentials");

  const scopes = await listScopesForServiceClient(pool, client.id);

  return signServiceToken({ clientId: client.client_id, tenantId: client.tenant_id, scopes });
}
