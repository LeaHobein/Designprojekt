const { spawn } = require("child_process");
const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const server = http.createServer((req, res) => {
  // Standarddatei ist index.html
  let filePath = path.join(__dirname, req.url === "/" ? "index.html" : req.url);

  // Dateiendung bestimmen, falls fehlt .html anfügen
  let ext = path.extname(filePath);
  if (!ext) {
    filePath += ".html";
    ext = ".html";
  }

  // MIME-Typen zuordnen
  const mimeTypes = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Datei nicht gefunden");
    }
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

// tshark als Prozess starten
const tshark = spawn("C:\\Program Files\\Wireshark\\tshark.exe", [
  "-i",
  "2", // Interface-Nummer ggf. anpassen
  "-T",
  "json"
]);

tshark.stdout.on("data", (data) => {
  const lines = data.toString().split("\n").filter(Boolean);
  lines.forEach((line) => {
    try {
      const json = JSON.parse(line);

      const packets = Array.isArray(json) ? json : [json];

      packets.forEach((packet) => {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(packet));
          }
        });
      });
    } catch (e) {
      // ungültiges JSON ignorieren
    }
  });
});

server.listen(3000, () => {
  console.log("Server läuft auf http://localhost:3000");
});
