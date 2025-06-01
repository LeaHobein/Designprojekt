const { spawn } = require("child_process");
const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");

const server = http.createServer((req, res) => {
  fs.readFile("index.html", (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end("Fehler beim Laden der HTML-Datei.");
    }
    res.writeHead(200);
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

// Hier wird tshark als Prozess gestartet:
const tshark = spawn("C:\\Program Files\\Wireshark\\tshark.exe", [
  "-i",
  "4", // Interface-Nummer ggf. anpassen!
  "-T",
  "json"
]);

tshark.stdout.on("data", (data) => {
  const lines = data.toString().split("\n").filter(Boolean);
  lines.forEach((line) => {
    try {
      const json = JSON.parse(line);

      if (Array.isArray(json)) {
        json.forEach((packet) => {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(packet));
            }
          });
        });
      } else {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(json));
          }
        });
      }
    } catch (e) {
      // ungültiges JSON ignorieren
    }
  });
});

server.listen(3000, () => {
  console.log("Server läuft auf http://localhost:3000");
});
