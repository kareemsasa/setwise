import { buildApp } from "./app.js";

const app = buildApp();
app.log.level = "info";

const start = async () => {
  const port = Number(process.env.PORT) || 4000;
  await app.listen({ port, host: "0.0.0.0" });
};

start();
