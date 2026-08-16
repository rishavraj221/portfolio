import type { Queryable } from "../lib/db.js";
import type { User } from "../types.js";

export async function createUser(db: Queryable, email: string, passwordHash: string): Promise<User> {
  const { rows } = await db.query<User>(
    "insert into users (email, password_hash) values ($1, $2) returning *",
    [email, passwordHash],
  );
  const user = rows[0];
  if (!user) throw new Error("failed to create user");
  return user;
}

export async function getUserByEmail(db: Queryable, email: string): Promise<User | null> {
  const { rows } = await db.query<User>("select * from users where email = $1", [email]);
  return rows[0] ?? null;
}

export async function getUserById(db: Queryable, userId: string): Promise<User | null> {
  const { rows } = await db.query<User>("select * from users where id = $1", [userId]);
  return rows[0] ?? null;
}
