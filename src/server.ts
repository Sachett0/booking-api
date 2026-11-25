import { buildApp } from "./app.ts";

const PORT = Number(process.env.PORT ?? 3333);

const app = buildApp({ logger: true });

// Graceful shutdown on Ctrl+C: finish in-flight requests before exiting.
async function shutdown() {
  await app.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: PORT, host: "0.0.0.0" });
