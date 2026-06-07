#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  TrainConnect Europe v2.0 – macOS Setup  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js nicht gefunden!"
    echo ""
    echo "Installation via Homebrew:"
    echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo "  brew install node"
    echo ""
    echo "Oder direkt von https://nodejs.org herunterladen."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js v18+ erforderlich. Aktuell: $(node -v)"
    echo "Update: brew upgrade node"
    exit 1
fi

echo "✅ Node.js $(node -v)"

# Install dependencies
echo ""
echo "📦 [1/3] Installiere Abhängigkeiten..."
npm install

# Create directories
echo "📁 [2/3] Erstelle Datenverzeichnis..."
mkdir -p data

# Set up .env if not exists
if [ ! -f ".env" ]; then
    echo "PORT=3000" > .env
    echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
    echo "📝 .env erstellt"
fi

# Start server
echo ""
echo "🚀 [3/3] Starte Server..."
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Server läuft auf: http://localhost:3000 ║"
echo "║  Zum Stoppen: Ctrl+C drücken             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Open browser after 2 seconds
(sleep 2 && open http://localhost:3000) &

node server.js
