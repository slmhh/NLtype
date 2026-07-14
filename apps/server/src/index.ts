import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerAuthRoutes } from "./auth/routes.js";
import { registerResultRoutes } from "./results/routes.js";

const server = Fastify({ logger: true });

await server.register(cors, {
  origin: ["http://localhost:5173"],
});

registerAuthRoutes(server);
registerResultRoutes(server);

server.get("/api/health", async () => {
  return { status: "ok", time: Date.now() };
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: "0.0.0.0" });
    console.log("Server running on http://localhost:3001");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
