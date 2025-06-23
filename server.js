const { spawn, exec } = require("child_process");
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

// --- HTTP Server ---
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
    const fileUrl = 'https://ash-speed.hetzner.com/10GB.bin';
    
    // **ANPASSUNG**: Wir holen uns das `request`-Objekt, um den Download bei Bedarf abbrechen zu können.
    const request = https.get(fileUrl, (downloadStream) => {
      // Prüfen, ob die Verbindung noch besteht, bevor wir Daten senden
      if (res.socket.destroyed) {
        downloadStream.destroy();
        return;
      }
      
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="10GB-testfile.bin"',
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

    // **NEU**: Listener, der reagiert, wenn der Benutzer die Verbindung schließt (z.B. Download abbricht).
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

// Hilfsfunktion, um eine Nachricht an alle Clients zu senden
function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// --- tshark-Funktion: Startet den Live-Mitschnitt für den Hintergrundverkehr ---
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

// --- Funktion zum Finden des tshark-Interfaces (AUTOMATISCH) ---
function findWifiInterfaceId(callback) {
  exec('"C:\\Program Files\\Wireshark\\tshark.exe" -D', (error, stdout, stderr) => {
    if (error) {
      console.error('Fehler beim Ausführen von tshark -D:', error);
      callback(null);
      return;
    }
    // Jede Zeile sieht etwa so aus: 4.\tIntel(R) Wi-Fi 6 AX201 160MHz (\Device\NPF_{...})
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (/wi-?fi|wireless/i.test(line)) {
        // Extrahiere die Interface-ID (Nummer vor dem Punkt)
        const match = line.match(/^(\d+)\./);
        if (match) {
          const id = match[1];
          console.log(`Gefundenes WiFi-Interface: ${id} -> ${line.trim()}`);
          callback(id);
          return;
        }
      }
    }
    console.warn('Kein WiFi-Interface gefunden! Fallback auf Interface 4.');
    callback('4'); // Fallback
  });
}

// --- Funktion zum Finden und Starten von tshark auf WiFi ---
function findAndStartTshark() {
  findWifiInterfaceId((INTERFACE_ID) => {
    if (!INTERFACE_ID) {
      console.error('Konnte keine Interface-ID für WiFi finden.');
      return;
    }
    console.log(`Starte tshark auf Interface: ${INTERFACE_ID}`);
    startTshark(INTERFACE_ID);
  });
}

// --- Arduino Logik ---
function findArduinoPortAndListen() {
  const { SerialPort } = require('serialport');
  SerialPort.list().then(ports => {
    console.log('Gefundene serielle Ports:', ports.map(p => `${p.path} (${p.manufacturer || ''} ${p.friendlyName || ''})`).join(', '));
    // Try to find a port that looks like an Arduino or generic USB serial
    const arduinoPortInfo = ports.find(port => {
      const str = `${port.manufacturer || ''} ${port.productId || ''} ${port.path || ''} ${port.friendlyName || ''} ${port.vendorId || ''}`.toLowerCase();
      return str.includes('arduino') || str.includes('ch340') || str.includes('usb-serial') || str.includes('usb serial');
    });
    if (!arduinoPortInfo) {
      console.warn('WARNUNG: Kein Arduino- oder USB-Serial-Port automatisch gefunden. Bitte prüfen Sie die Verkabelung.');
      return;
    }
    const portPath = arduinoPortInfo.path;
    const arduinoPort = new SerialPort({ path: portPath, baudRate: 9600 });
    const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    console.log(`Lausche auf Arduino an ${portPath}...`);
    parser.on('data', data => {
      if (data.trim() === 'KLICK') {
        console.log('Arduino-Klick erkannt! Sende Startsignal...');
        broadcast(JSON.stringify({ type: 'START_DOWNLOAD' }));
      }
    });
  }).catch(err => {
    console.warn('WARNUNG: Fehler beim Suchen nach Arduino-Ports:', err);
  });
}

findArduinoPortAndListen();

// --- Serverstart ---
server.listen(3000, () => {
  console.log('Server läuft auf http://localhost:3000');
  // Starte die tshark-Überwachung für den Hintergrundverkehr.
  findAndStartTshark();
});