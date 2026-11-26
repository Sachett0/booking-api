import { buildApp } from "./app.ts";
import { config } from "./config.ts";

const app = buildApp({ logger: true });

// Graceful shutdown on Ctrl+C: finish in-flight requests before exiting.
async function shutdown() {
  await app.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: config.port, host: "0.0.0.0" });
