#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  TrainConnect Europe v2.0 – Linux Setup  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Detect distro
if command -v apt-get &> /dev/null; then
    PKG="apt"
elif command -v dnf &> /dev/null; then
    PKG="dnf"
elif command -v pacman &> /dev/null; then
    PKG="pacman"
else
    PKG="unknown"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js nicht gefunden!"
    echo ""
    echo "Installation:"
    if [ "$PKG" = "apt" ]; then
        echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs"
    elif [ "$PKG" = "dnf" ]; then
        echo "  sudo dnf install -y nodejs npm"
    elif [ "$PKG" = "pacman" ]; then
        echo "  sudo pacman -S nodejs npm"
    else
        echo "  Bitte von https://nodejs.org herunterladen"
    fi
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js v18+ erforderlich. Aktuell: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v)"

# Install dependencies
echo ""
echo "📦 [1/4] Installiere Abhängigkeiten..."
npm install

# Directories
echo "📁 [2/4] Erstelle Verzeichnisse..."
mkdir -p data logs

# .env
if [ ! -f ".env" ]; then
    cat > .env << EOF
PORT=3000
JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64)
NODE_ENV=production
EOF
    echo "📝 .env erstellt"
fi

# Permissions
chmod +x setup/setup-linux.sh

# Systemd service (optional)
echo ""
echo "🔧 [3/4] Systemd-Service (optional)"
echo ""
read -p "Systemd-Service einrichten? (automatischer Start beim Booten) [j/N]: " SETUP_SERVICE
if [[ "$SETUP_SERVICE" =~ ^[jJyY] ]]; then
    SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/..
    cat > /tmp/trainconnect.service << EOF
[Unit]
Description=TrainConnect Europe
After=network.target

[Service]
Type=simple
WorkingDirectory=${SCRIPT_DIR}
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    sudo cp /tmp/trainconnect.service /etc/systemd/system/trainconnect.service
    sudo systemctl daemon-reload
    sudo systemctl enable trainconnect
    sudo systemctl start trainconnect
    echo "✅ Service gestartet! Status: sudo systemctl status trainconnect"
    echo "   Logs: sudo journalctl -u trainconnect -f"
    exit 0
fi

# Start
echo ""
echo "🚀 [4/4] Starte Server..."
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Server läuft auf: http://localhost:3000 ║"
echo "║  Zum Stoppen: Ctrl+C drücken             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Try to open browser
(sleep 2 && (xdg-open http://localhost:3000 2>/dev/null || true)) &

node server.js
