# 🚆 TrainConnect Europe v2.0

**Die einheitliche Plattform für Zugreisen in Europa.**  
Ein Ticket. Ganz Europa. — DB · SBB · SNCF · ÖBB · NS · Eurostar und mehr.

---

## ⚡ Schnellstart

### Windows
```
Doppelklick: setup\setup-windows.bat
```

### macOS
```bash
chmod +x setup/setup-macos.sh && ./setup/setup-macos.sh
```

### Linux
```bash
chmod +x setup/setup-linux.sh && ./setup/setup-linux.sh
```

Die Website öffnet sich automatisch unter **http://localhost:3000**

---

## 🏗️ Projektstruktur

```
trainconnect-europe/
├── server.js              # Hauptserver (Express)
├── server/
│   ├── db.js              # Datenbank-Schicht (JSON, PostgreSQL-ready)
│   ├── auth.js            # JWT-Auth + Zahlungsverarbeitung
│   └── routes.js          # Alle API-Endpunkte
├── public/
│   ├── index.html         # Frontend (komplette SPA)
│   ├── manifest.json      # PWA-Manifest
│   └── sw.js              # Service Worker (Offline)
├── mobile/
│   ├── App.js             # React Native App (iOS & Android)
│   └── package.json       # Expo-Abhängigkeiten
├── setup/
│   ├── setup-windows.bat
│   ├── setup-macos.sh
│   └── setup-linux.sh
└── data/                  # Datenbank (auto-erstellt)
    └── db.json
```

---

## 📱 Mobile App (iOS & Android)

### Voraussetzungen
- Node.js v18+
- Expo CLI: `npm install -g expo-cli`

### Starten
```bash
cd mobile
npm install
npx expo start
```
- **iOS:** QR-Code mit der Expo Go App scannen
- **Android:** QR-Code mit der Expo Go App scannen
- **iOS Build:** `npx expo build:ios` (Apple Developer Account erforderlich, $99/Jahr)
- **Android Build:** `npx expo build:android`

### API-URL anpassen
In `mobile/App.js` Zeile 1:
```js
const API_BASE = 'http://DEINE-IP:3000/api';
```

---

## 💳 Zahlungsmethoden

| Methode | Provider | Produktiv |
|---------|----------|-----------|
| 💳 Kreditkarte | Stripe | `STRIPE_SECRET_KEY` in .env |
| 🅿️ PayPal | PayPal | `PAYPAL_CLIENT_ID` in .env |
| 🍎 Apple Pay | Stripe | automatisch via Stripe |
| 🟢 Google Pay | Stripe | automatisch via Stripe |
| 🇨🇭 TWINT | TWINT API | `TWINT_API_KEY` in .env |
| 🏦 SEPA | Stripe | automatisch via Stripe |
| ₿ Bitcoin | Coinbase Commerce | `COINBASE_API_KEY` in .env |
| ⟠ Ethereum | Coinbase Commerce | automatisch |
| 💵 USDT | Coinbase Commerce | automatisch |

**Für Produktivbetrieb** in `server/auth.js` die `processPayment()`-Funktion  
mit den echten SDK-Calls von Stripe / PayPal / Coinbase ersetzen.

---

## 🌍 Unterstützte Bahngesellschaften (16)

🇩🇪 DB · 🇨🇭 SBB · 🇦🇹 ÖBB · 🇫🇷 SNCF · 🇳🇱 NS · 🇧🇪 NMBS/SNCB  
🇮🇹 Trenitalia · 🇪🇸 Renfe · 🇬🇧 Eurostar · 🇮🇪 Irish Rail  
🇨🇿 RegioJet · 🇵🇱 PKP Intercity · 🇭🇺 MÁV-Start  
🇩🇰 DSB · 🇸🇪 SJ · 🇳🇴 Vy

---

## 🔌 API-Endpunkte

```
POST /api/auth/register       Registrierung
POST /api/auth/login          Anmeldung
GET  /api/auth/me             Aktueller Nutzer
PUT  /api/auth/profile        Profil aktualisieren

GET  /api/stations/search     Bahnhofsuche
GET  /api/search              Verbindungssuche
GET  /api/price-calendar      Preiskalender
GET  /api/popular-routes      Beliebte Strecken
GET  /api/payment-methods     Zahlungsmethoden

POST /api/checkout            Ticket buchen
GET  /api/tickets             Meine Tickets
GET  /api/tickets/:id         Ticket-Details
POST /api/tickets/:id/cancel  Stornieren
GET  /api/tracking/:id        Live-Tracking + EU-Entschädigung

GET  /api/alerts              Preisalarme
POST /api/alerts              Preisalarm setzen
DELETE /api/alerts/:id        Preisalarm löschen

GET  /api/operators           Alle Betreiber + Fahrgastrechte-URLs
GET  /api/admin/stats         Admin-Statistiken
GET  /api/admin/users         Alle Nutzer
PUT  /api/admin/users/:id/role Rolle ändern
```

---

## ⚙️ Umgebungsvariablen (.env)

```env
PORT=3000
JWT_SECRET=dein-geheimer-schluessel-min-32-zeichen

# Stripe (Kreditkarte, Apple Pay, Google Pay, SEPA)
STRIPE_SECRET_KEY=sk_live_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# TWINT
TWINT_API_KEY=...

# Coinbase Commerce (Bitcoin, Ethereum, USDT)
COINBASE_API_KEY=...
```

---

## 🛡️ Sicherheitsfeatures

- **Helmet.js** – HTTP-Security-Header
- **Rate Limiting** – 20 Auth-Anfragen/15 Min., 200 API-Anfragen/Min.
- **JWT** – 30 Tage gültig, RS256
- **bcrypt** – Passwort-Hashing (12 Rounds)
- **CORS** – konfigurierbar
- **Input-Validierung** auf allen Endpunkten

---

## ⚖️ EU-Fahrgastrechte (VO EU 2021/782)

- Ab 60 Min. Verspätung: **25% Erstattung**
- Ab 120 Min. Verspätung: **50% Erstattung**
- Direkte Links zu allen Betreiber-Entschädigungsformularen
- EU-Initiative vom 13. Mai 2026: Single European Rail Ticket

---

## 🔄 Auf PostgreSQL migrieren

1. `npm install pg` installieren
2. In `server/db.js` die Funktionen durch `pg`-Queries ersetzen
3. Schema: `CREATE TABLE users (...); CREATE TABLE tickets (...);`
4. `DATABASE_URL=postgresql://...` in `.env` eintragen

---

## 📞 Kontakt

- **Datenschutz:** datenschutz@trainconnect.eu
- **Partnerschaft / API:** datenschutz@trainconnect.eu
