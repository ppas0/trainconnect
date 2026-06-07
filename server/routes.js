const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { users, tickets, priceAlerts, stations, routes, errors } = require('./db');
const { authenticate, adminOnly, JWT_SECRET, PAYMENT_METHODS, processPayment } = require('./auth');

const router = express.Router();

// ── HEALTH ───────────────────────────────────────────────────────────────────
router.get('/health', (req, res) => res.json({ status:'ok', version:'2.0', time: new Date().toISOString() }));

// ── AUTH ─────────────────────────────────────────────────────────────────────
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email||!password||!name) return res.status(400).json({ error:'Alle Felder sind pflicht' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error:'Ungültige E-Mail' });
    if (password.length < 6) return res.status(400).json({ error:'Passwort min. 6 Zeichen' });
    if (users.findByEmail(email)) return res.status(409).json({ error:'E-Mail bereits registriert' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = users.create({ email, passwordHash, name });
    const token = jwt.sign({ id:user.id, email:user.email, role:user.role }, JWT_SECRET, { expiresIn:'30d' });
    res.status(201).json({ token, user:{ id:user.id, email:user.email, name:user.name, role:user.role, loyaltyPoints:0 } });
  } catch(e) { errors.log({ type:'register', message:e.message }); res.status(500).json({ error:'Serverfehler' }); }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ error:'E-Mail oder Passwort falsch' });
    const token = jwt.sign({ id:user.id, email:user.email, role:user.role }, JWT_SECRET, { expiresIn:'30d' });
    res.json({ token, user:{ id:user.id, email:user.email, name:user.name, role:user.role, loyaltyPoints:user.loyaltyPoints } });
  } catch(e) { res.status(500).json({ error:'Serverfehler' }); }
});

router.get('/auth/me', authenticate, (req, res) => {
  const user = users.findById(req.user.id);
  if (!user) return res.status(404).json({ error:'Nutzer nicht gefunden' });
  res.json({ id:user.id, email:user.email, name:user.name, role:user.role, loyaltyPoints:user.loyaltyPoints, createdAt:user.createdAt });
});

router.put('/auth/profile', authenticate, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const user = users.findById(req.user.id);
    if (!user) return res.status(404).json({ error:'Nutzer nicht gefunden' });
    const patch = {};
    if (name) patch.name = name;
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error:'Aktuelles Passwort erforderlich' });
      if (!(await bcrypt.compare(currentPassword, user.passwordHash)))
        return res.status(401).json({ error:'Aktuelles Passwort falsch' });
      if (newPassword.length < 6) return res.status(400).json({ error:'Neues Passwort min. 6 Zeichen' });
      patch.passwordHash = await bcrypt.hash(newPassword, 12);
    }
    const updated = users.update(req.user.id, patch);
    res.json({ id:updated.id, email:updated.email, name:updated.name, role:updated.role, loyaltyPoints:updated.loyaltyPoints });
  } catch(e) { res.status(500).json({ error:'Serverfehler' }); }
});

// ── STATIONS ─────────────────────────────────────────────────────────────────
router.get('/stations/init',   (req, res) => res.json({ count: stations.count(), message:'Bahnhöfe bereit' }));
router.get('/stations/search', (req, res) => {
  const { q } = req.query;
  if (!q||q.length<1) return res.json([]);
  res.json(stations.search(q));
});
router.get('/stations',        (req, res) => res.json(stations.all()));

// ── SEARCH ───────────────────────────────────────────────────────────────────
router.get('/search', authenticate, (req, res) => {
  try {
    const { from, to, date, passengers='1', class: sc='2' } = req.query;
    if (!from||!to||!date) return res.status(400).json({ error:'from, to und date sind pflicht' });
    if (from===to) return res.status(400).json({ error:'Start und Ziel dürfen nicht gleich sein' });
    const pax = Math.min(Math.max(parseInt(passengers)||1, 1), 9);
    const results = routes.search({ fromId:from, toId:to, date, passengers:pax, seatClass:sc });
    res.json({ results, count:results.length });
  } catch(e) {
    errors.log({ type:'search', message:e.message, query:req.query });
    res.status(500).json({ error:'Suche fehlgeschlagen' });
  }
});

// ── PRICE CALENDAR ────────────────────────────────────────────────────────────
router.get('/price-calendar', authenticate, (req, res) => {
  const { from, to, month, year, passengers='1', class: sc='2' } = req.query;
  if (!from||!to) return res.status(400).json({ error:'from und to erforderlich' });
  const now = new Date();
  const cal = routes.priceCalendar({
    fromId:from, toId:to,
    month: parseInt(month||now.getMonth()+1),
    year:  parseInt(year||now.getFullYear()),
    passengers: parseInt(passengers), seatClass: sc
  });
  res.json(cal);
});

// ── POPULAR ROUTES ────────────────────────────────────────────────────────────
router.get('/popular-routes', (req, res) => {
  res.json([
    { from:'ZRH', to:'BER', fromName:'Zürich HB',       toName:'Berlin Hbf',         price:49, duration:'7h 30min' },
    { from:'VIE', to:'MUC', fromName:'Wien Hbf',         toName:'München Hbf',        price:29, duration:'4h 00min' },
    { from:'BRU', to:'LON', fromName:'Brüssel Midi',     toName:'London St Pancras',  price:59, duration:'2h 00min' },
    { from:'CDG', to:'MIL', fromName:'Paris Gare du Nord',toName:'Milano Centrale',   price:39, duration:'6h 45min' },
    { from:'BER', to:'WAW', fromName:'Berlin Hbf',       toName:'Warszawa Centralna', price:35, duration:'5h 15min' },
    { from:'ZRH', to:'AMS', fromName:'Zürich HB',        toName:'Amsterdam Centraal', price:45, duration:'8h 00min' },
    { from:'BCN', to:'MAD', fromName:'Barcelona Sants',  toName:'Madrid Atocha',      price:25, duration:'2h 30min' },
    { from:'ROM', to:'MIL', fromName:'Roma Termini',     toName:'Milano Centrale',    price:19, duration:'2h 55min' },
    { from:'HAM', to:'MUC', fromName:'Hamburg Hbf',      toName:'München Hbf',        price:29, duration:'5h 45min' },
  ]);
});

// ── PAYMENT METHODS ───────────────────────────────────────────────────────────
router.get('/payment-methods', (req, res) => {
  res.json(Object.entries(PAYMENT_METHODS).map(([id, m]) => ({ id, ...m })));
});

// ── CHECKOUT ─────────────────────────────────────────────────────────────────
router.post('/checkout', authenticate, async (req, res) => {
  try {
    const { connection, paymentMethod, seatPreference } = req.body;
    if (!connection||!paymentMethod) return res.status(400).json({ error:'Verbindung und Zahlungsmethode erforderlich' });
    if (!PAYMENT_METHODS[paymentMethod]) return res.status(400).json({ error:'Ungültige Zahlungsmethode' });

    // Process payment
    const payment = await processPayment({
      method: paymentMethod, amount: connection.price,
      currency: 'EUR', userId: req.user.id
    });

    // Assign random seat
    const seatNum = seatPreference || `${Math.floor(Math.random()*8)+1}${String.fromCharCode(65+Math.floor(Math.random()*6))}`;

    const ticket = tickets.create({
      userId: req.user.id,
      fromStation: connection.fromStation, fromId: connection.fromId,
      toStation:   connection.toStation,   toId:   connection.toId,
      departureTime: connection.departureTime, arrivalTime: connection.arrivalTime,
      trainNumber: connection.trainNumber,  operator: connection.operator,
      seatClass: connection.seatClass,      passengers: connection.passengers,
      price: connection.price,              paymentMethod,
      paymentId: payment.paymentId,         changes: connection.changes,
      duration: connection.duration,        amenities: Object.keys(connection.amenities||{}).filter(k=>connection.amenities[k]),
      seatNumber: seatNum
    });

    // Add initial tracking event
    tickets.addTracking(ticket.id, { status:'Ticket ausgestellt', station: connection.fromStation, delay: 0 });

    // Award loyalty points
    users.updatePoints(req.user.id, Math.floor(connection.price));

    res.status(201).json({ success:true, ticket, paymentId: payment.paymentId, message:'Zahlung erfolgreich! Dein Ticket ist bereit.' });
  } catch(e) {
    errors.log({ type:'checkout', message:e.message, userId:req.user?.id });
    res.status(500).json({ error: e.message || 'Buchung fehlgeschlagen' });
  }
});

// ── TICKETS ───────────────────────────────────────────────────────────────────
router.get('/tickets', authenticate, (req, res) => {
  res.json(tickets.findByUser(req.user.id));
});

router.get('/tickets/:id', authenticate, (req, res) => {
  const t = tickets.findById(req.params.id);
  if (!t) return res.status(404).json({ error:'Ticket nicht gefunden' });
  if (t.userId !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error:'Kein Zugriff' });
  res.json(t);
});

router.post('/tickets/:id/cancel', authenticate, (req, res) => {
  try {
    const t = tickets.findById(req.params.id);
    if (!t) return res.status(404).json({ error:'Ticket nicht gefunden' });
    if (t.userId !== req.user.id) return res.status(403).json({ error:'Kein Zugriff' });
    if (t.status === 'cancelled') return res.status(400).json({ error:'Ticket bereits storniert' });
    // Refund policy: full refund if >24h before departure
    const hoursToDepart = (new Date(t.departureTime) - new Date()) / 3600000;
    const refund = hoursToDepart > 24 ? t.price : hoursToDepart > 2 ? Math.round(t.price*0.5) : 0;
    const cancelled = tickets.cancel(t.id, refund);
    users.updatePoints(req.user.id, -Math.floor(t.price)); // always reverse earned points on cancellation
    res.json({ success:true, ticket:cancelled, refundAmount:refund, message: refund>0 ? `Erstattung von €${refund} eingeleitet.` : 'Storniert ohne Rückerstattung (< 2h vor Abfahrt).' });
  } catch(e) { res.status(500).json({ error:'Stornierung fehlgeschlagen' }); }
});

const OPERATOR_COMPENSATION_URLS = {
  'DB':'https://www.bahn.de/hilfe/fahrgastrechte',
  'Deutsche Bahn':'https://www.bahn.de/hilfe/fahrgastrechte',
  'ÖBB':'https://www.oebb.at/de/reise-information/fahrgastrechte',
  'SBB':'https://www.sbb.ch/de/hilfe-und-kontakt/kundenservice/entschaedigungen.html',
  'SNCF':'https://www.sncf-connect.com/aide/mes-droits-de-voyageur',
  'Trenitalia':'https://www.trenitalia.com/it/informazioni/Diritti_del_Viaggiatore.html',
  'Renfe':'https://www.renfe.com',
  'NS':'https://www.ns.nl',
  'NMBS':'https://www.belgiantrain.be',
  'Eurostar':'https://www.eurostar.com/uk-en/travel-info/travel-updates',
  'RegioJet':'https://www.regiojet.de',
  'PKP':'https://www.pkpintercity.pl',
  'MÁV':'https://www.mavcsoport.hu',
  'DSB':'https://www.dsb.dk',
  'SJ':'https://www.sj.se',
  'Vy':'https://www.vy.no',
};
router.get('/tracking/:id', authenticate, (req, res) => {
  const t = tickets.findById(req.params.id);
  if (!t) return res.status(404).json({ error:'Ticket nicht gefunden' });
  if (t.userId !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error:'Kein Zugriff' });

  // Simulate live tracking events
  const now = new Date();
  const dep = new Date(t.departureTime);
  const arr = new Date(t.arrivalTime);
  const liveDelay = Math.random() < 0.3 ? Math.floor(Math.random()*25) : 0; // 30% chance of delay

  const events = [
    { status:'Ticket ausgestellt', station: t.fromStation, delay:0, time: t.createdAt },
    ...(now > dep ? [
      { status:'Zug abgefahren', station: t.fromStation, delay: liveDelay, time: dep.toISOString() }
    ] : []),
    ...(now > arr ? [
      { status:'Angekommen', station: t.toStation, delay: Math.max(0, liveDelay-3), time: arr.toISOString() }
    ] : []),
  ];

  const euCompensation = liveDelay >= 60 ? {
    eligible: true,
    percentage: liveDelay >= 120 ? 50 : 25,
    amount: liveDelay >= 120 ? Math.round(t.price*0.5) : Math.round(t.price*0.25),
    url: OPERATOR_COMPENSATION_URLS[t.operator] || 'https://ec.europa.eu/transport/themes/passengers/rail_en'
  } : null;

  res.json({ ticket:t, events, currentDelay: liveDelay, euCompensation });
});

// ── PRICE ALERTS ─────────────────────────────────────────────────────────────
router.get('/alerts', authenticate, (req, res) => {
  res.json(priceAlerts.findByUser(req.user.id));
});

router.post('/alerts', authenticate, (req, res) => {
  const { fromId, toId, fromName, toName, targetPrice } = req.body;
  if (!fromId||!toId||!targetPrice) return res.status(400).json({ error:'fromId, toId und targetPrice erforderlich' });
  const alert = priceAlerts.create({ userId:req.user.id, fromId, toId, fromName, toName, targetPrice });
  res.status(201).json(alert);
});

router.delete('/alerts/:id', authenticate, (req, res) => {
  priceAlerts.delete(req.params.id);
  res.json({ success:true });
});

// ── ADMIN ─────────────────────────────────────────────────────────────────────
router.get('/admin/stats', authenticate, adminOnly, (req, res) => {
  const allTickets = tickets.all();
  const allUsers   = users.all();
  const revenue    = tickets.revenue();
  const cancelled  = allTickets.filter(t=>t.status==='cancelled').length;

  const byOperator = allTickets.reduce((a,t)=>{ a[t.operator]=(a[t.operator]||0)+1; return a; }, {});
  const byPayment  = allTickets.reduce((a,t)=>{ a[t.paymentMethod]=(a[t.paymentMethod]||0)+1; return a; }, {});
  const byDay      = allTickets.reduce((a,t)=>{ const d=t.createdAt.slice(0,10); a[d]=(a[d]||0)+t.price; return a; }, {});
  const byClass    = allTickets.reduce((a,t)=>{ a[t.seatClass]=(a[t.seatClass]||0)+1; return a; }, {});

  res.json({
    users: allUsers.length, tickets: allTickets.length,
    revenue: revenue.toFixed(2), cancelled,
    activeUsers: allUsers.filter(u=>u.role!=='admin').length,
    recentTickets: tickets.recentSales(10),
    byOperator, byPayment, byDay, byClass
  });
});

router.get('/admin/users', authenticate, adminOnly, (req, res) => {
  res.json(users.all().map(u => ({
    id:u.id, email:u.email, name:u.name, role:u.role,
    createdAt:u.createdAt, loyaltyPoints:u.loyaltyPoints,
    ticketCount: tickets.findByUser(u.id).length
  })));
});

router.put('/admin/users/:id/role', authenticate, adminOnly, (req, res) => {
  const { role } = req.body;
  if (!['user','admin'].includes(role)) return res.status(400).json({ error:'Ungültige Rolle' });
  const updated = users.update(req.params.id, { role });
  if (!updated) return res.status(404).json({ error:'Nutzer nicht gefunden' });
  res.json({ success:true, user:updated });
});

router.get('/admin/errors', authenticate, adminOnly, (req, res) => {
  res.json(require('./db').errors.recent(50));
});

// ── LEGAL/INFO ────────────────────────────────────────────────────────────────
router.get('/operators', (req, res) => {
  res.json([
    { code:'DE', flag:'🇩🇪', name:'Deutschland', operator:'DB (Deutsche Bahn)', url:'https://www.bahn.de/hilfe/fahrgastrechte', refund60:'25%', refund120:'50%' },
    { code:'AT', flag:'🇦🇹', name:'Österreich',  operator:'ÖBB',                url:'https://www.oebb.at/de/reise-information/fahrgastrechte', refund60:'25%', refund120:'50%' },
    { code:'CH', flag:'🇨🇭', name:'Schweiz',     operator:'SBB CFF FFS',        url:'https://www.sbb.ch/de/hilfe-und-kontakt/kundenservice/entschaedigungen.html', refund60:'25%', refund120:'50%' },
    { code:'FR', flag:'🇫🇷', name:'Frankreich',  operator:'SNCF',               url:'https://www.sncf-connect.com/aide/mes-droits-de-voyageur', refund60:'25%', refund120:'50%' },
    { code:'IT', flag:'🇮🇹', name:'Italien',     operator:'Trenitalia',         url:'https://www.trenitalia.com/it/informazioni/Diritti_del_Viaggiatore.html', refund60:'25%', refund120:'50%' },
    { code:'ES', flag:'🇪🇸', name:'Spanien',     operator:'Renfe',              url:'https://www.renfe.com', refund60:'25%', refund120:'50%' },
    { code:'NL', flag:'🇳🇱', name:'Niederlande', operator:'NS',                 url:'https://www.ns.nl', refund60:'25%', refund120:'50%' },
    { code:'BE', flag:'🇧🇪', name:'Belgien',     operator:'NMBS/SNCB',          url:'https://www.belgiantrain.be', refund60:'25%', refund120:'50%' },
    { code:'GB', flag:'🇬🇧', name:'Grossbritannien', operator:'Eurostar',       url:'https://www.eurostar.com/uk-en/travel-info/travel-updates', refund60:'25%', refund120:'50%' },
    { code:'IE', flag:'🇮🇪', name:'Irland',      operator:'Irish Rail',         url:'https://www.irishrail.ie', refund60:'25%', refund120:'50%' },
    { code:'CZ', flag:'🇨🇿', name:'Tschechien',  operator:'RegioJet',           url:'https://www.regiojet.de', refund60:'25%', refund120:'50%' },
    { code:'PL', flag:'🇵🇱', name:'Polen',        operator:'PKP Intercity',      url:'https://www.pkpintercity.pl', refund60:'25%', refund120:'50%' },
    { code:'HU', flag:'🇭🇺', name:'Ungarn',       operator:'MÁV-Start',          url:'https://www.mavcsoport.hu', refund60:'25%', refund120:'50%' },
    { code:'DK', flag:'🇩🇰', name:'Dänemark',    operator:'DSB',                url:'https://www.dsb.dk', refund60:'25%', refund120:'50%' },
    { code:'SE', flag:'🇸🇪', name:'Schweden',     operator:'SJ',                 url:'https://www.sj.se', refund60:'25%', refund120:'50%' },
    { code:'NO', flag:'🇳🇴', name:'Norwegen',    operator:'Vy',                 url:'https://www.vy.no', refund60:'25%', refund120:'50%' },
  ]);
});

module.exports = router;
