import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { triage } from "./triage.mjs";

const html = await readFile(new URL("./index.html", import.meta.url));
const screen = await readFile(new URL("./screen.mjs", import.meta.url));

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export function createApp() {
  return createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(html);
      return;
    }
    if (request.method === "GET" && request.url === "/screen.mjs") {
      response.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(screen);
      return;
    }
    if (request.method !== "POST" || request.url !== "/api/triage") {
      return json(response, 404, { status: "not_found" });
    }
    const result = await triage(await readBody(request));
    json(response, result.http, result.body);
  });
}

const startedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (startedDirectly) {
  createApp().listen(Number(process.env.PORT || 3000), "127.0.0.1");
}
