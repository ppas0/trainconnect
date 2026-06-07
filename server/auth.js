const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'trainconnect-v2-secret-2026-longkey-xyz';

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht angemeldet' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Kein Zugriff' });
  next();
}

// Payment method config (keys from env in production)
const PAYMENT_METHODS = {
  card:       { label: 'Kreditkarte',      icon: '💳', provider: 'stripe',   enabled: true },
  paypal:     { label: 'PayPal',           icon: '🅿️', provider: 'paypal',   enabled: true },
  apple_pay:  { label: 'Apple Pay',        icon: '🍎', provider: 'stripe',   enabled: true },
  google_pay: { label: 'Google Pay',       icon: '🟢', provider: 'stripe',   enabled: true },
  twint:      { label: 'TWINT',            icon: '🇨🇭', provider: 'twint',    enabled: true },
  sepa:       { label: 'SEPA Banküberweisung', icon: '🏦', provider: 'stripe', enabled: true },
  crypto_btc: { label: 'Bitcoin (BTC)',    icon: '₿',  provider: 'coinbase', enabled: true },
  crypto_eth: { label: 'Ethereum (ETH)',   icon: '⟠',  provider: 'coinbase', enabled: true },
  crypto_usdt:{ label: 'USDT (Tether)',    icon: '💵', provider: 'coinbase', enabled: true },
};

// Simulated payment processor (replace with real Stripe/PayPal SDK calls)
async function processPayment({ method, amount, currency, userId }) {
  // In production: switch on provider and call respective API
  const provider = PAYMENT_METHODS[method]?.provider || 'stripe';
  // Simulate processing time
  await new Promise(r => setTimeout(r, 300));
  // Simulate 97% success rate (real payments have failures too)
  if (Math.random() < 0.03) throw new Error('Zahlung abgelehnt – bitte andere Methode versuchen');
  return {
    paymentId: `${provider.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`,
    provider, amount, currency, status: 'completed'
  };
}

module.exports = { authenticate, adminOnly, JWT_SECRET, PAYMENT_METHODS, processPayment };
