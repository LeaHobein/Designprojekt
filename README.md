Live Netzwerk-Visualisierung mit TShark

Voraussetzungen:

- Windows-PC
- Wireshark (inkl. TShark) (beim installieren anhaken)
- Node.js

Notes/Changes:

- package.json Inhalt hat sich verändert
- start.bat wird nicht mehr benötigt
- Visualierung sieht etwas anders aus, aber ist noch nicht die finale Version
- mit einem angeschlossenem Arduino und Knopf kann ein Download gestartet werden, muss aber manuell wieder beendet werden
- Interface-Nr. muss manuell geändert werden
- in dem Geräte-Manager sieht man welcher Anschluss (COM) der Arduino ist, muss dann in server.js selbst geändert werden
- am PC (LAN) hatte ich im Hintergrund viel Datenverkehr, aber im WLAN irgendwie nicht so, vllt. kann das einfach behoben werden, indem ein        anderer Download im Hintergrund läuft bei der Präsentation
- https://ash-speed.hetzner.com Seite für Testfile-downloads