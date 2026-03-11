import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get("/api/health", () => ({
    localOnly: true,
    status: "ok"
  }));
}
