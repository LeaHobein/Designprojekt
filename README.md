Live Netzwerk-Visualisierung mit TShark

Voraussetzungen:
- Windows-PC
- Wireshark (inkl. TShark) (beim installieren anhaken)
- Node.js


1. Der Pfad wo tshark installiert ist soll kopiert werden
2. Dann bei CMD folgendes eingeben: "PFAD WO TSHARK INSTALLIERT IST" -D 
(-> MIT Gänsefüßchen) und dann ENTER-Taste drücken
3. Es erscheint eine Liste in der Konsole
4. Womit ist der PC mit dem Internet verbunden? (LAN oder WLAN)
5. Dann die Zahl von z.B. WLAN merken -> z.B. "4." (es ist immer
die vordere Zahl, also die Auflistung, gemeint)
6. Im Server.js wird dann die Zahl hier eingegeben:
const interfaceId = "4";
7. Zum Starten dann start.bat als Admin öffnen
8. Im Browser http://localhost:3000 einfügen

