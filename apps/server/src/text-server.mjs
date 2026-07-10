import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "..", "data");

const words = JSON.parse(fs.readFileSync(path.join(DATA, "words.json"), "utf-8"));
const chinese = JSON.parse(fs.readFileSync(path.join(DATA, "chinese.json"), "utf-8"));

function generateEnglish() {
  const target = 200;
  const out = [];
  let len = 0;
  while (len < target) {
    const w = words[(Math.random() * words.length) | 0];
    out.push(w);
    len += w.length + 1;
  }
  return out.slice(0, -1).join(" ");
}

function getChinese() {
  return chinese[(Math.random() * chinese.length) | 0];
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.url === "/api/text/english") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ text: generateEnglish() }));
  } else if (req.url === "/api/text/chinese") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ text: getChinese() }));
  } else {
    res.writeHead(404);
    res.end("{}");
  }
});

const PORT = 3001;
server.listen(PORT, () => console.log("Text server on http://localhost:" + PORT));
