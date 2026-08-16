import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./lib/env.js";
import { authRoutes } from "./routes/auth.js";
import { authorizeRoutes } from "./routes/authorize.js";
import { meRoutes } from "./routes/me.js";
import { adminRoutes } from "./routes/admin.js";
import { demoRoutes } from "./routes/demo.js";
import { ZodError } from "zod";

const app = Fastify({
  logger: {
    transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
  },
});

await app.register(cors, { origin: true });

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof ZodError) {
    return reply.code(400).send({ error: "validation failed", issues: err.issues });
  }
  app.log.error(err);
  return reply.code(500).send({ error: "internal error" });
});

app.get("/healthz", async () => ({ ok: true }));

await app.register(authRoutes);
await app.register(authorizeRoutes);
await app.register(meRoutes);
await app.register(adminRoutes);
await app.register(demoRoutes);

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .then(() => app.log.info(`rbac-demo backend listening on :${env.port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
