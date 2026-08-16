import type { Queryable } from "../lib/db.js";
import type { Permission } from "../types.js";

export async function createPermission(
  db: Queryable,
  key: string,
  description?: string,
): Promise<Permission> {
  const { rows } = await db.query<Permission>(
    "insert into permissions (key, description) values ($1, $2) on conflict (key) do update set description = excluded.description returning *",
    [key, description ?? null],
  );
  const permission = rows[0];
  if (!permission) throw new Error("failed to create permission");
  return permission;
}

export async function listPermissions(db: Queryable): Promise<Permission[]> {
  const { rows } = await db.query<Permission>("select * from permissions order by key asc");
  return rows;
}

export async function getPermissionsByKeys(db: Queryable, keys: string[]): Promise<Permission[]> {
  if (keys.length === 0) return [];
  const { rows } = await db.query<Permission>("select * from permissions where key = any($1)", [keys]);
  return rows;
}
