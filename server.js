const { spawn, exec } = require("child_process");
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

//HTTP Server
const server = http.createServer((req, res) => {
  // Route für die Hauptseite
  if (req.url === '/') {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Fehler beim Laden der index.html');
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } 
  // Route für den Download (wird von der Webseite aufgerufen)
  else if (req.url === '/start-download') {
    console.log('Download-Anfrage erhalten. Starte den Download-Stream...');
    const fileUrl = 'https://ash-speed.hetzner.com/1GB.bin';
    
    
    const request = https.get(fileUrl, (downloadStream) => {
      // Prüfen, ob die Verbindung noch besteht, bevor wir Daten senden
      if (res.socket.destroyed) {
        downloadStream.destroy();
        return;
      }
      
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="1GB-testfile.bin"',
      });

      // Für jedes ankommende Datenpaket...
      downloadStream.on('data', (chunk) => {
        // ...sende eine "download-packet"-Nachricht für die intensive Visualisierung.
        const packetCount = 0.1; 
        for (let i = 0; i < packetCount; i++) {
            broadcast(JSON.stringify({ type: 'download-packet' }));
        }
      });

      // Leite die Datei direkt an den Browser weiter.
      downloadStream.pipe(res);
      downloadStream.on('end', () => console.log('Download-Stream beendet.'));
    });

    
    res.on('close', () => {
      console.log('Client hat die Verbindung getrennt. Breche den Server-Download ab.');
      request.destroy(); // Bricht die ausgehende HTTPS-Anfrage ab.
    });

    // Fehlerbehandlung für die Download-Anfrage
    request.on('error', (err) => {
      console.error('Fehler beim Herunterladen der Datei:', err.message);
      if (!res.headersSent) {
        res.writeHead(500).end('Fehler beim Herunterladen.');
      }
    });

  } else {
    res.writeHead(404).end('Seite nicht gefunden');
  }
});

const wss = new WebSocket.Server({ server });


function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// tshark-Funktion: Startet den Live-Mitschnitt für den Hintergrundverkehr
function startTshark(interfaceId) {
  console.log(`Starte tshark für Hintergrundverkehr auf Interface ${interfaceId}...`);
  const tshark = spawn("C:\\Program Files\\Wireshark\\tshark.exe", ["-i", interfaceId, "-T", "json", "-l"]);

  tshark.stdout.on("data", (data) => {
    const lines = data.toString().split("\n").filter(Boolean);
    lines.forEach((line) => {
      try {
        JSON.parse(line); // Nur prüfen, ob es valides JSON ist
        // Sende eine "tshark-packet"-Nachricht für den Hintergrundverkehr.
        broadcast(JSON.stringify({ type: 'tshark-packet' }));
      } catch (e) { /* Ignorieren */ }
    });
  });

  tshark.stderr.on('data', (data) => {
    const message = data.toString();
    if (!message.includes("Capturing on")) {
      console.error(`tshark stderr: ${message.trim()}`);
    }
  });

  tshark.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`FEHLER: tshark wurde mit Code ${code} beendet. Bitte als Administrator starten.`);
    }
  });
}



function findAndStartTshark() {

  //Kristina: INTERFACE_ID = '4'; path: 'COM5',
  //Lea: INTERFACE_ID = '5'; path: 'COM4', beim eigenen `COM5` bei Ethernet: 8
  //Krystyna: INTERFACE_ID = '5'; path: 'COM5',

  const INTERFACE_ID = '5'; 

  console.log(`Starte tshark auf dem manuell festgelegten Interface: ${INTERFACE_ID}`);
  console.log("Falls dies nicht funktioniert, starte das Skript neu und prüfe die Nummer mit 'tshark -D' in der Kommandozeile.");

  startTshark(INTERFACE_ID);
}

//Arduino-Logik
try {
  const arduinoPort = new SerialPort({ path: 'COM4', baudRate: 9600 });
  const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));
  console.log("Lausche auf Arduino an COM5...");
  parser.on('data', data => {
    if (data.trim() === 'KLICK') {
      console.log('Arduino-Klick erkannt! Sende Startsignal...');
      broadcast(JSON.stringify({ type: 'START_DOWNLOAD' }));
    }});
    } catch (err) {
  console.warn("WARNUNG: Arduino-Port COM5 nicht gefunden.");
}


server.listen(3000, () => {
  console.log('Server läuft auf http://localhost:3000');
  // Starte die tshark-Überwachung für den Hintergrundverkehr.
  findAndStartTshark();
});