'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const {
  PORT = 3000, ALLOWED_ORIGIN = '', DB_HOST = 'localhost', DB_PORT = 3306, DB_USER, DB_PASSWORD, DB_NAME = 'ashgrove',
  SMTP_HOST, SMTP_PORT = 587, SMTP_SECURE = 'false', SMTP_USER, SMTP_PASS, MAIL_FROM, OWNER_EMAIL, REPLY_WINDOW = 'two working days',
  ADMIN_EMAIL, ADMIN_PASSWORD_HASH, ADMIN_SECRET
} = process.env;

const pool = mysql.createPool({
  host: DB_HOST, port: Number(DB_PORT), user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
  waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4'
});

const mailer = SMTP_HOST
  ? nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT), secure: SMTP_SECURE === 'true', auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined })
  : null;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));
app.use(cors({ origin: ALLOWED_ORIGIN ? ALLOWED_ORIGIN.split(',').map(s => s.trim()) : false, methods: ['POST', 'GET', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { ok: false, message: 'Too many requests. Please try again later.' } });
app.use('/api/', limiter);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const first = n => n.split(/\s+/)[0] || n;

async function sendMail(opts) {
  if (!mailer) { console.warn('Email not configured (SMTP_HOST missing). Skipped:', opts.subject); return false; }
  try { await mailer.sendMail({ from: MAIL_FROM || SMTP_USER, ...opts }); return true; }
  catch (e) { console.error('Email failed:', e.message); return false; }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* ---------- sign up ---------- */
app.post('/api/signup', async (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 120), email = clean(b.email, 190).toLowerCase(), password = String(b.password || ''), username = clean(b.username, 30).toLowerCase();
  const errors = {};
  if (!name) errors.name = 'Add your name.';
  if (!/^[a-z0-9_]{3,30}$/.test(username)) errors.username = 'Use 3 to 30 letters, numbers or underscores.';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (password.length < 8) errors.password = 'Use at least 8 characters.';
  if (password.length > 72) errors.password = 'Use 72 characters or fewer.';
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });
  try {
    const hash = await bcrypt.hash(password, 12);
    await pool.execute('INSERT INTO users (name, username, email, password_hash) VALUES (?, ?, ?, ?)', [name, username, email, hash]);
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      const m = String(e.message || '');
      return res.status(409).json({ ok: false, errors: m.includes('username') ? { username: 'That username is taken.' } : { email: 'That email already has an account.' } });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Something went wrong on our side. Please try again.' });
  }
  sendMail({
    to: email, subject: 'Welcome to Ashgrove Construction',
    text: `Hello ${first(name)},\n\nYour account is ready. Thank you for signing up.\n\nAshgrove Construction`,
    html: `<p>Hello ${esc(first(name))},</p><p>Your account is ready. Thank you for signing up.</p><p>Ashgrove Construction</p>`
  });
  res.status(201).json({ ok: true, message: `Thanks, ${first(name)}. Your account is ready. A confirmation email is on its way.` });
});

/* ---------- contact form: save, reply to the sender, notify the owner ---------- */
app.post('/api/contact', async (req, res) => {
  const b = req.body || {};
  if (clean(b.website, 200)) return res.json({ ok: true, message: 'Thanks. We will reply soon.' }); /* honeypot: bots fill this in */
  const d = {
    name: clean(b.name, 120), email: clean(b.email, 190).toLowerCase(), phone: clean(b.phone, 40),
    type: clean(b.type, 80), budget: clean(b.budget, 80), when: clean(b.when, 80), message: clean(b.message, 4000)
  };
  const errors = {};
  if (!d.name) errors.name = 'Add your name so we know who to reply to.';
  if (!EMAIL_RE.test(d.email)) errors.email = 'Enter an email address we can reply to.';
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });
  let id;
  try {
    const [r] = await pool.execute(
      'INSERT INTO contacts (name, email, phone, project_type, budget, start_when, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [d.name, d.email, d.phone || null, d.type || null, d.budget || null, d.when || null, d.message || null]);
    id = r.insertId;
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'That did not send. Please try again or email us directly.' });
  }
  /* automatic reply to the person */
  sendMail({
    to: d.email, replyTo: OWNER_EMAIL || undefined, subject: 'We received your estimate request',
    text: `Hello ${first(d.name)},\n\nThank you for contacting Ashgrove Construction. We have your request and will reply within ${REPLY_WINDOW}.\n\nWhat you sent us:\nProject type: ${d.type || '-'}\nBudget: ${d.budget || '-'}\nIdeal start: ${d.when || '-'}\nMessage: ${d.message || '-'}\n\nAshgrove Construction`,
    html: `<p>Hello ${esc(first(d.name))},</p><p>Thank you for contacting Ashgrove Construction. We have your request and will reply within ${esc(REPLY_WINDOW)}.</p><p><strong>What you sent us</strong><br>Project type: ${esc(d.type || '-')}<br>Budget: ${esc(d.budget || '-')}<br>Ideal start: ${esc(d.when || '-')}<br>Message: ${esc(d.message || '-')}</p><p>Ashgrove Construction</p>`
  }).then(ok => { if (ok) pool.execute('UPDATE contacts SET replied_at = NOW() WHERE id = ?', [id]).catch(() => {}); });
  /* notification to you */
  if (OWNER_EMAIL) sendMail({
    to: OWNER_EMAIL, replyTo: d.email, subject: `New estimate request from ${d.name}`,
    text: `Name: ${d.name}\nEmail: ${d.email}\nPhone: ${d.phone || '-'}\nType: ${d.type || '-'}\nBudget: ${d.budget || '-'}\nStart: ${d.when || '-'}\n\n${d.message || ''}`,
    html: `<p><strong>New estimate request</strong></p><p>Name: ${esc(d.name)}<br>Email: ${esc(d.email)}<br>Phone: ${esc(d.phone || '-')}<br>Type: ${esc(d.type || '-')}<br>Budget: ${esc(d.budget || '-')}<br>Start: ${esc(d.when || '-')}</p><p>${esc(d.message).replace(/\n/g, '<br>')}</p>`
  });
  res.status(201).json({ ok: true, message: `Thanks, ${first(d.name)}. We will reply within ${REPLY_WINDOW}.` });
});

app.use((_req, res) => res.status(404).json({ ok: false, message: 'Not found.' }));


/* ---------- admin ---------- */
/* Signed token (HMAC, 8 hours). Set ADMIN_EMAIL, ADMIN_PASSWORD_HASH (bcrypt) and ADMIN_SECRET (long random text) in .env */
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { ok: false, message: 'Too many sign in attempts. Try again later.' } });
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = p => crypto.createHmac('sha256', ADMIN_SECRET || '').update(p).digest('base64url');
function makeToken(sub = 'admin', hours = 8, extra = {}) { const p = b64({ sub, exp: Date.now() + hours * 3600 * 1000, ...extra }); return p + '.' + sign(p); }
function readToken(t) {
  try {
    const [p, s] = String(t || '').split('.');
    if (!p || !s || !ADMIN_SECRET) return null;
    const a = Buffer.from(s), c = Buffer.from(sign(p));
    if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) return null;
    const d = JSON.parse(Buffer.from(p, 'base64url'));
    return d.exp > Date.now() ? d : null;
  } catch (_) { return null; }
}
function adminOnly(req, res, next) {
  if (!ADMIN_SECRET || ADMIN_SECRET.length < 24) return res.status(503).json({ ok: false, message: 'Admin is not configured.' });
  const t = String(req.headers.authorization || '').replace(/^Bearer /, ''), [p, s] = t.split('.');
  try {
    if (!p || !s) throw 0;
    const a = Buffer.from(s), c = Buffer.from(sign(p));
    if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) throw 0;
    const dec = JSON.parse(Buffer.from(p, 'base64url'));
    if (dec.exp < Date.now() || dec.sub !== 'admin') throw 0;
    next();
  } catch (_) { res.status(401).json({ ok: false, message: 'Please sign in again.' }); }
}

/* ---------- customer sign in (username or email, plus password) ---------- */
app.post('/api/login', loginLimiter, async (req, res) => {
  const id = clean(req.body && req.body.username, 190).toLowerCase(), password = String((req.body && req.body.password) || '').slice(0, 72);
  if (!ADMIN_SECRET || ADMIN_SECRET.length < 24) return res.status(503).json({ ok: false, message: 'Sign in is not configured.' });
  if (!id || !password) return res.status(400).json({ ok: false, message: 'Enter your username and password.' });
  try {
    const [rows] = await pool.execute('SELECT id, name, username, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1', [id, id]);
    const u = rows[0];
    const ok = u ? await bcrypt.compare(password, u.password_hash) : await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv').catch(() => false);
    if (!u || !ok) return res.status(401).json({ ok: false, message: 'Username or password is not right.' });
    res.json({ ok: true, token: makeToken('user', 24 * 7, { uid: u.id }), name: u.name, username: u.username });
  } catch (e) { console.error(e.message); res.status(500).json({ ok: false, message: 'Something went wrong on our side. Please try again.' }); }
});
app.get('/api/me', async (req, res) => {
  const d = readToken(String(req.headers.authorization || '').replace(/^Bearer /, ''));
  if (!d || d.sub !== 'user') return res.status(401).json({ ok: false, message: 'Please sign in again.' });
  try { const [rows] = await pool.execute('SELECT name, username, email FROM users WHERE id = ?', [d.uid]); if (!rows[0]) throw 0; res.json({ ok: true, user: rows[0] }); }
  catch (_) { res.status(401).json({ ok: false }); }
});

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const email = clean(req.body && req.body.email, 190).toLowerCase(), password = String((req.body && req.body.password) || '').slice(0, 72);
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH || !ADMIN_SECRET) return res.status(503).json({ ok: false, message: 'Admin is not configured.' });
  const okEmail = email === ADMIN_EMAIL.toLowerCase(), okPass = await bcrypt.compare(password, ADMIN_PASSWORD_HASH).catch(() => false);
  if (!okEmail || !okPass) return res.status(401).json({ ok: false, message: 'Email or password is not right.' });
  res.json({ ok: true, token: makeToken() });
});
app.get('/api/admin/enquiries', adminOnly, async (_req, res) => {
  try { const [rows] = await pool.query('SELECT id, name, email, phone, project_type, budget, start_when, message, replied_at, created_at FROM contacts ORDER BY created_at DESC LIMIT 500'); res.json({ ok: true, rows }); }
  catch (e) { console.error(e.message); res.status(500).json({ ok: false, message: 'Could not load enquiries.' }); }
});
app.get('/api/admin/users', adminOnly, async (_req, res) => {
  try { const [rows] = await pool.query('SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 500'); res.json({ ok: true, rows }); }
  catch (e) { console.error(e.message); res.status(500).json({ ok: false, message: 'Could not load users.' }); }
});
app.post('/api/admin/enquiries/:id/replied', adminOnly, async (req, res) => {
  try { await pool.execute('UPDATE contacts SET replied_at = NOW() WHERE id = ?', [Number(req.params.id) || 0]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false }); }
});

app.listen(Number(PORT), () => console.log(`Ashgrove API listening on port ${PORT}`));
