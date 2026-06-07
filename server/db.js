/**
 * TrainConnect Europe v2.0 – Datenbank-Schicht
 * JSON-Datei-basiert (drop-in für PostgreSQL via prisma/pg)
 */
const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../data/db.json');

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const init = { users:[], tickets:[], pricealerts:[], errors:[], meta:{ version:'2.0', created: new Date().toISOString() } };
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2));
    return init;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function saveDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

let _writeLock = Promise.resolve();
function withLock(fn) { return (_writeLock = _writeLock.then(fn).catch(fn)); }

// ── USERS ─────────────────────────────────────────────────────────────────────
const users = {
  findByEmail: e  => loadDB().users.find(u => u.email === e.toLowerCase()) || null,
  findById:    id => loadDB().users.find(u => u.id === id) || null,
  create(data) {
    const db = loadDB();
    const user = { id: uuidv4(), email: data.email.toLowerCase(), passwordHash: data.passwordHash,
      name: data.name, role: data.role||'user', createdAt: new Date().toISOString(),
      loyaltyPoints: 0, passwordResetToken: null, passwordResetExpiry: null };
    db.users.push(user); saveDB(db); return user;
  },
  update(id, patch) {
    const db = loadDB();
    const u = db.users.find(u => u.id === id);
    if (u) { Object.assign(u, patch); saveDB(db); }
    return u;
  },
  updatePoints(id, delta) {
    return withLock(() => {
      const db = loadDB();
      const u = db.users.find(u => u.id === id);
      if (u) { u.loyaltyPoints = Math.max(0, (u.loyaltyPoints||0) + delta); saveDB(db); }
    });
  },
  count: () => loadDB().users.length,
  all:   () => loadDB().users
};

// ── TICKETS ───────────────────────────────────────────────────────────────────
const tickets = {
  create(data) {
    const db = loadDB();
    const ticket = {
      id: uuidv4(),
      ticketCode: 'TC-' + Math.random().toString(36).toUpperCase().slice(2, 9),
      userId: data.userId, fromStation: data.fromStation, fromId: data.fromId,
      toStation: data.toStation, toId: data.toId,
      departureTime: data.departureTime, arrivalTime: data.arrivalTime,
      trainNumber: data.trainNumber, operator: data.operator,
      seatClass: data.seatClass||'2', passengers: data.passengers||1,
      price: data.price, currency: 'EUR', status: 'confirmed',
      paymentMethod: data.paymentMethod, paymentId: data.paymentId||null,
      changes: data.changes||0, duration: data.duration||'',
      amenities: data.amenities||[], trackingEvents: [],
      createdAt: new Date().toISOString(), cancelledAt: null,
      refundAmount: null, seatNumber: data.seatNumber||null
    };
    db.tickets.push(ticket); saveDB(db); return ticket;
  },
  findByUser: userId => {
    const db = loadDB();
    return db.tickets.filter(t => t.userId === userId)
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  findById: id => loadDB().tickets.find(t => t.id === id) || null,
  cancel(id, refundAmount) {
    const db = loadDB();
    const t = db.tickets.find(t => t.id === id);
    if (t) { t.status='cancelled'; t.cancelledAt=new Date().toISOString(); t.refundAmount=refundAmount; saveDB(db); }
    return t;
  },
  addTracking(id, event) {
    const db = loadDB();
    const t = db.tickets.find(t => t.id === id);
    if (t) { t.trackingEvents = t.trackingEvents||[]; t.trackingEvents.push({...event, ts: new Date().toISOString()}); saveDB(db); }
  },
  count:     () => loadDB().tickets.length,
  revenue:   () => loadDB().tickets.filter(t=>t.status!=='cancelled').reduce((s,t)=>s+(t.price||0),0),
  all:       () => loadDB().tickets,
  recentSales: (n=10) => loadDB().tickets.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,n)
};

// ── PRICE ALERTS ──────────────────────────────────────────────────────────────
const priceAlerts = {
  create(data) {
    const db = loadDB();
    const alert = { id: uuidv4(), userId: data.userId, fromId: data.fromId, toId: data.toId,
      fromName: data.fromName, toName: data.toName, targetPrice: data.targetPrice,
      active: true, createdAt: new Date().toISOString(), triggeredAt: null };
    db.pricealerts = db.pricealerts||[]; db.pricealerts.push(alert); saveDB(db); return alert;
  },
  findByUser: userId => { const db=loadDB(); return (db.pricealerts||[]).filter(a=>a.userId===userId); },
  delete(id) { const db=loadDB(); db.pricealerts=(db.pricealerts||[]).filter(a=>a.id!==id); saveDB(db); }
};

// ── STATIONS ─────────────────────────────────────────────────────────────────
const STATIONS = [
  // Deutschland
  { id:'BER', name:'Berlin Hbf',         city:'Berlin',       country:'DE', lat:52.5251, lon:13.3694 },
  { id:'MUC', name:'München Hbf',        city:'München',      country:'DE', lat:48.1402, lon:11.5602 },
  { id:'HAM', name:'Hamburg Hbf',        city:'Hamburg',      country:'DE', lat:53.5530, lon:10.0061 },
  { id:'FRA', name:'Frankfurt Hbf',      city:'Frankfurt',    country:'DE', lat:50.1072, lon:8.6637  },
  { id:'KOL', name:'Köln Hbf',           city:'Köln',         country:'DE', lat:50.9430, lon:6.9590  },
  { id:'STU', name:'Stuttgart Hbf',      city:'Stuttgart',    country:'DE', lat:48.7840, lon:9.1827  },
  { id:'DUS', name:'Düsseldorf Hbf',     city:'Düsseldorf',   country:'DE', lat:51.2199, lon:6.7942  },
  { id:'DOR', name:'Dortmund Hbf',       city:'Dortmund',     country:'DE', lat:51.5178, lon:7.4593  },
  { id:'NUR', name:'Nürnberg Hbf',       city:'Nürnberg',     country:'DE', lat:49.4454, lon:11.0820 },
  { id:'DRE', name:'Dresden Hbf',        city:'Dresden',      country:'DE', lat:51.0407, lon:13.7326 },
  // Schweiz
  { id:'ZRH', name:'Zürich HB',          city:'Zürich',       country:'CH', lat:47.3783, lon:8.5404  },
  { id:'BSL', name:'Basel SBB',          city:'Basel',        country:'CH', lat:47.5476, lon:7.5899  },
  { id:'GEN', name:'Genf Cornavin',      city:'Genf',         country:'CH', lat:46.2104, lon:6.1422  },
  { id:'BRN', name:'Bern Hbf',           city:'Bern',         country:'CH', lat:46.9488, lon:7.4393  },
  { id:'LUZ', name:'Luzern',             city:'Luzern',       country:'CH', lat:47.0502, lon:8.3093  },
  // Österreich
  { id:'VIE', name:'Wien Hbf',           city:'Wien',         country:'AT', lat:48.1848, lon:16.3762 },
  { id:'SZG', name:'Salzburg Hbf',       city:'Salzburg',     country:'AT', lat:47.8126, lon:13.0454 },
  { id:'IBK', name:'Innsbruck Hbf',      city:'Innsbruck',    country:'AT', lat:47.2639, lon:11.4014 },
  { id:'GRZ', name:'Graz Hbf',           city:'Graz',         country:'AT', lat:47.0707, lon:15.3913 },
  // Frankreich
  { id:'CDG', name:'Paris Gare du Nord', city:'Paris',        country:'FR', lat:48.8809, lon:2.3553  },
  { id:'PGL', name:'Paris Gare de Lyon', city:'Paris',        country:'FR', lat:48.8450, lon:2.3735  },
  { id:'LYO', name:'Lyon Part-Dieu',     city:'Lyon',         country:'FR', lat:45.7606, lon:4.8598  },
  { id:'MRS', name:'Marseille St-Charles',city:'Marseille',   country:'FR', lat:43.3026, lon:5.3808  },
  { id:'NCE', name:'Nice Ville',          city:'Nizza',       country:'FR', lat:43.7045, lon:7.2619  },
  { id:'BDX', name:'Bordeaux St-Jean',   city:'Bordeaux',     country:'FR', lat:44.8255, lon:-0.5561 },
  // Niederlande
  { id:'AMS', name:'Amsterdam Centraal', city:'Amsterdam',    country:'NL', lat:52.3791, lon:4.9003  },
  { id:'RTD', name:'Rotterdam Centraal', city:'Rotterdam',    country:'NL', lat:51.9248, lon:4.4687  },
  { id:'DHA', name:'Den Haag Centraal',  city:'Den Haag',     country:'NL', lat:52.0800, lon:4.3250  },
  // Belgien
  { id:'BRU', name:'Brüssel Midi',       city:'Brüssel',      country:'BE', lat:50.8354, lon:4.3363  },
  { id:'ANT', name:'Antwerpen Centraal', city:'Antwerpen',    country:'BE', lat:51.2172, lon:4.4215  },
  // Italien
  { id:'ROM', name:'Roma Termini',       city:'Rom',          country:'IT', lat:41.9009, lon:12.5012 },
  { id:'MIL', name:'Milano Centrale',   city:'Mailand',      country:'IT', lat:45.4860, lon:9.2045  },
  { id:'VEN', name:'Venezia Santa Lucia',city:'Venedig',      country:'IT', lat:45.4414, lon:12.3209 },
  { id:'FLR', name:'Firenze SMN',        city:'Florenz',      country:'IT', lat:43.7746, lon:11.2480 },
  { id:'NAP', name:'Napoli Centrale',    city:'Neapel',       country:'IT', lat:40.8536, lon:14.2700 },
  // Spanien
  { id:'MAD', name:'Madrid Atocha',      city:'Madrid',       country:'ES', lat:40.4065, lon:-3.6892 },
  { id:'BCN', name:'Barcelona Sants',    city:'Barcelona',    country:'ES', lat:41.3795, lon:2.1404  },
  { id:'SVQ', name:'Sevilla Santa Justa',city:'Sevilla',      country:'ES', lat:37.3916, lon:-5.9757 },
  // UK
  { id:'LON', name:'London St Pancras',  city:'London',       country:'GB', lat:51.5308, lon:-0.1233 },
  { id:'LOV', name:'London Victoria',    city:'London',       country:'GB', lat:51.4952, lon:-0.1441 },
  { id:'EDI', name:'Edinburgh Waverley', city:'Edinburgh',    country:'GB', lat:55.9521, lon:-3.1897 },
  { id:'MAN', name:'Manchester Piccadilly',city:'Manchester', country:'GB', lat:53.4771, lon:-2.2309 },
  // Irland
  { id:'DUB', name:'Dublin Heuston',     city:'Dublin',       country:'IE', lat:53.3461, lon:-6.2931 },
  // Osteuropa
  { id:'PRG', name:'Praha hl. n.',       city:'Prag',         country:'CZ', lat:50.0831, lon:14.4356 },
  { id:'WAW', name:'Warszawa Centralna', city:'Warschau',     country:'PL', lat:52.2288, lon:21.0031 },
  { id:'BUD', name:'Budapest Keleti',    city:'Budapest',     country:'HU', lat:47.5001, lon:19.0836 },
  { id:'BRQ', name:'Brno hl. n.',        city:'Brünn',        country:'CZ', lat:49.1909, lon:16.6118 },
  { id:'KRK', name:'Kraków Główny',      city:'Krakau',       country:'PL', lat:50.0670, lon:19.9450 },
  // Skandinavien
  { id:'CPH', name:'København H',        city:'Kopenhagen',   country:'DK', lat:55.6727, lon:12.5644 },
  { id:'STO', name:'Stockholm C',        city:'Stockholm',    country:'SE', lat:59.3299, lon:18.0575 },
  { id:'OSL', name:'Oslo S',             city:'Oslo',         country:'NO', lat:59.9110, lon:10.7526 },
];

const OPERATORS = {
  DE:'DB (Deutsche Bahn)', CH:'SBB CFF FFS', AT:'ÖBB', FR:'SNCF', NL:'NS',
  BE:'NMBS/SNCB', IT:'Trenitalia', ES:'Renfe', GB:'Eurostar', IE:'Irish Rail',
  CZ:'RegioJet', PL:'PKP Intercity', HU:'MÁV-Start', DK:'DSB', SE:'SJ', NO:'Vy'
};
const OPERATOR_RIGHTS = {
  'DB (Deutsche Bahn)': 'https://www.bahn.de/hilfe/fahrgastrechte',
  'SBB CFF FFS':        'https://www.sbb.ch/de/hilfe-und-kontakt/kundenservice/entschaedigungen.html',
  'ÖBB':                'https://www.oebb.at/de/reise-information/fahrgastrechte',
  'SNCF':               'https://www.sncf-connect.com/aide/mes-droits-de-voyageur',
  'Trenitalia':         'https://www.trenitalia.com/it/informazioni/Diritti_del_Viaggiatore.html',
  'Renfe':              'https://www.renfe.com/es/es/cercanias/cercanias-madrid/informacion-al-viajero',
  'Eurostar':           'https://www.eurostar.com/uk-en/travel-info/travel-updates',
  'Irish Rail':         'https://www.irishrail.ie/en-IE/travel-information/passenger-charter',
};
const TRAIN_TYPES = ['ICE','TGV','EC','IC','RJ','NJ','Railjet','EuroCity'];
const AMENITIES_BY_TYPE = {
  ICE:     { wifi:true,  dining:true,  powerOutlets:true, quiet:true, airConditioning:true, bikeStorage:false, wheelchair:true, sleepingCar:false, couchette:false },
  TGV:     { wifi:true,  dining:true,  powerOutlets:true, quiet:true, airConditioning:true, bikeStorage:true,  wheelchair:true, sleepingCar:false, couchette:false },
  EC:      { wifi:false, dining:true,  powerOutlets:true, quiet:false,airConditioning:true, bikeStorage:true,  wheelchair:true, sleepingCar:false, couchette:false },
  IC:      { wifi:false, dining:false, powerOutlets:true, quiet:false,airConditioning:true, bikeStorage:false, wheelchair:true, sleepingCar:false, couchette:false },
  RJ:      { wifi:true,  dining:true,  powerOutlets:true, quiet:true, airConditioning:true, bikeStorage:false, wheelchair:true, sleepingCar:false, couchette:false },
  NJ:      { wifi:true,  dining:false, powerOutlets:true, quiet:false,airConditioning:true, bikeStorage:false, wheelchair:true, sleepingCar:true,  couchette:true  },
  Railjet: { wifi:true,  dining:true,  powerOutlets:true, quiet:true, airConditioning:true, bikeStorage:false, wheelchair:true, sleepingCar:false, couchette:false },
  EuroCity:{ wifi:false, dining:true,  powerOutlets:false,quiet:false,airConditioning:true, bikeStorage:true,  wheelchair:true, sleepingCar:false, couchette:false },
};
const PRICE_CALENDAR_VARIATION = [0.6,0.7,0.75,0.8,0.85,0.9,1.0,1.1,1.2,1.35,1.5,1.7,0.65,0.72,0.88,0.95,1.05,1.15,1.25,1.4,1.55,1.65,0.78,0.92,1.02,0.98,1.08,1.18,0.82,0.68];

function calcDistance(from, to) {
  const dx = from.lon - to.lon; const dy = from.lat - to.lat;
  return Math.sqrt(dx*dx + dy*dy) * 111;
}
function calcDuration(dist) {
  const mins = Math.max(30, Math.round(dist / 200 * 60));
  return `${Math.floor(mins/60)}h ${String(mins%60).padStart(2,'0')}min`;
}
function calcBasePrice(dist, seatClass, passengers) {
  const base = Math.max(19, Math.round(dist * 0.11));
  return Math.round(base * (seatClass==='1'?1.65:1) * passengers);
}

const stations = {
  init() { /* stations are in-memory, always ready */ },
  search(q) {
    const l = q.toLowerCase();
    return STATIONS.filter(s =>
      s.name.toLowerCase().includes(l) || s.city.toLowerCase().includes(l) ||
      s.id.toLowerCase() === l || s.country.toLowerCase().includes(l)
    ).slice(0, 10);
  },
  findById: id => STATIONS.find(s => s.id === id) || null,
  all:   () => STATIONS,
  count: () => STATIONS.length
};

const routes = {
  search({ fromId, toId, date, passengers, seatClass }) {
    const from = STATIONS.find(s => s.id === fromId);
    const to   = STATIONS.find(s => s.id === toId);
    if (!from || !to) return [];
    const dist     = calcDistance(from, to);
    const isCross  = from.country !== to.country;
    const results  = [];
    const numRes   = 5 + Math.floor(Math.random()*3);
    const dayOfYear= Math.floor((new Date(date)-new Date(new Date().getFullYear()+'-01-01'))/(86400000));
    const dayVar   = PRICE_CALENDAR_VARIATION[dayOfYear % PRICE_CALENDAR_VARIATION.length];

    for (let i=0; i<numRes; i++) {
      const depH = 5 + i*2 + Math.floor(Math.random()*2);
      const depM = [0,15,30,45][Math.floor(Math.random()*4)];
      const dep  = new Date(date); dep.setHours(depH, depM, 0, 0);
      const travelMins = Math.max(30, Math.round(dist/200*60));
      const changes    = dist>900 ? Math.floor(Math.random()*2) : 0;
      const arr  = new Date(dep.getTime() + (travelMins + changes*25)*60000);
      const trainType  = TRAIN_TYPES[Math.floor(Math.random()*TRAIN_TYPES.length)];
      const trainNum   = trainType + ' ' + (100 + Math.floor(Math.random()*900));
      const operator   = isCross ? 'Eurostar' : (OPERATORS[from.country]||'DB (Deutsche Bahn)');
      const amenities  = AMENITIES_BY_TYPE[trainType] || AMENITIES_BY_TYPE.IC;
      const isNight    = depH >= 22 || depH <= 5;
      const basePrice  = calcBasePrice(dist, seatClass, passengers);
      const variation  = (0.8 + Math.random()*0.5) * dayVar;
      const price      = Math.round(basePrice * variation);
      const seats      = 20 + Math.floor(Math.random()*180);
      const occupancy  = seats < 50 ? 'high' : seats < 120 ? 'medium' : 'low';

      results.push({
        id: require('uuid').v4(),
        fromStation: from.name, fromId: from.id, fromCity: from.city,
        toStation: to.name, toId: to.id, toCity: to.city,
        departureTime: dep.toISOString(), arrivalTime: arr.toISOString(),
        duration: calcDuration(dist), trainNumber: trainNum, operator,
        operatorRightsUrl: OPERATOR_RIGHTS[operator]||null,
        changes, price, currency:'EUR', seatClass, passengers,
        availableSeats: seats, occupancy, isNightTrain: isNight,
        amenities, distance: Math.round(dist),
        priceBreakdown: {
          baseFare: Math.round(price*0.7), taxes: Math.round(price*0.15),
          serviceFee: Math.round(price*0.05), seatReservation: Math.round(price*0.1)
        }
      });
    }
    return results.sort((a,b) => new Date(a.departureTime)-new Date(b.departureTime));
  },

  priceCalendar({ fromId, toId, month, year, passengers, seatClass }) {
    const from = STATIONS.find(s=>s.id===fromId);
    const to   = STATIONS.find(s=>s.id===toId);
    if (!from||!to) return [];
    const dist  = calcDistance(from, to);
    const base  = calcBasePrice(dist, seatClass, passengers);
    const days  = new Date(year, month, 0).getDate();
    const cal   = [];
    for (let d=1; d<=days; d++) {
      const v = PRICE_CALENDAR_VARIATION[(d-1) % PRICE_CALENDAR_VARIATION.length];
      cal.push({ day:d, price: Math.round(base * v * (0.85+Math.random()*0.3)) });
    }
    return cal;
  }
};

const errors = {
  log(data) {
    const db = loadDB();
    db.errors.push({ id:uuidv4(), ...data, timestamp:new Date().toISOString() });
    if (db.errors.length>200) db.errors=db.errors.slice(-200);
    saveDB(db);
  },
  recent: (n=30) => loadDB().errors.slice(-n).reverse()
};

module.exports = { users, tickets, priceAlerts, stations, routes, errors, STATIONS, OPERATORS, loadDB, saveDB };
