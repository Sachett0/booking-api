import Fastify, { type FastifyServerOptions } from "fastify";

/**
 * Monta a aplicação, mas NÃO a coloca no ar.
 *
 * Separar "montar" (app.ts) de "ligar" (server.ts) permite que os testes
 * criem a app e façam requisições direto nela, sem abrir uma porta de rede.
 */
export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  return app;
}
