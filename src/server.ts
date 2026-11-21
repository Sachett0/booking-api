import { buildApp } from "./app.ts";

const PORT = Number(process.env.PORT ?? 3333);

const app = buildApp({ logger: true });

// Encerra com calma no Ctrl+C: termina as requisições em andamento antes de sair.
async function shutdown() {
  await app.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: PORT, host: "0.0.0.0" });
