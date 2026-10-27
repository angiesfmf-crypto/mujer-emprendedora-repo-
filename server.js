'use strict';
require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT || 3000);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });
  pool.on('error', err => console.error('Error inesperado en PostgreSQL:', err.message));
}

app.get('/api/health', async (_req, res) => {
  let database = 'not_configured';
  if (pool) {
    try { await pool.query('SELECT 1'); database = 'connected'; }
    catch (_e) { database = 'unavailable'; }
  }
  res.status(database === 'unavailable' ? 503 : 200).json({
    ok: database !== 'unavailable', service: 'mujer-emprendedora-api', database,
    timestamp: new Date().toISOString()
  });
});

// API foundation for future multi-device synchronization. The current browser UI
// keeps its demo records in IndexedDB until its sync client is connected to these routes.
app.get('/api/entrepreneurs', async (_req, res, next) => {
  if (!pool) return res.status(503).json({ error: 'DATABASE_URL no está configurada.' });
  try {
    const { rows } = await pool.query('SELECT id, full_name, email, business_name, phone, location, activity, digital_level, created_at FROM entrepreneurs ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { next(e); }
});

app.post('/api/entrepreneurs', async (req, res, next) => {
  if (!pool) return res.status(503).json({ error: 'DATABASE_URL no está configurada.' });
  const { fullName, email, businessName, phone = '', location = '', activity = '', digitalLevel = '' } = req.body || {};
  if (![fullName, email, businessName].every(v => typeof v === 'string' && v.trim())) {
    return res.status(400).json({ error: 'Nombre, correo y nombre del emprendimiento son obligatorios.' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO entrepreneurs (full_name,email,business_name,phone,location,activity,digital_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id,full_name,email,business_name,phone,location,activity,digital_level,created_at`,
      [fullName.trim(), email.trim().toLowerCase(), businessName.trim(), phone, location, activity, digitalLevel]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    next(e);
  }
});

app.get('/api/products', async (_req, res, next) => {
  if (!pool) return res.status(503).json({ error: 'DATABASE_URL no está configurada.' });
  try { const { rows } = await pool.query('SELECT * FROM products ORDER BY created_at DESC'); res.json(rows); }
  catch (e) { next(e); }
});

app.post('/api/products', async (req, res, next) => {
  if (!pool) return res.status(503).json({ error: 'DATABASE_URL no está configurada.' });
  const { entrepreneurId, name, category = '', price, stock } = req.body || {};
  if (!entrepreneurId || typeof name !== 'string' || !name.trim() || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
    return res.status(400).json({ error: 'Datos de producto no válidos.' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO products (entrepreneur_id,name,category,price,stock) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [entrepreneurId, name.trim(), category, Number(price), Number(stock)]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

app.get('/api/sales', async (req, res, next) => {
  if (!pool) return res.status(503).json({ error: 'DATABASE_URL no está configurada.' });
  const entrepreneurId = req.query.entrepreneurId;
  if (!entrepreneurId) return res.status(400).json({ error: 'Falta entrepreneurId.' });
  try {
    const { rows } = await pool.query('SELECT * FROM sales WHERE entrepreneur_id=$1 ORDER BY sold_at DESC', [entrepreneurId]);
    res.json(rows);
  } catch (e) { next(e); }
});

app.post('/api/sales', async (req, res, next) => {
  if (!pool) return res.status(503).json({ error: 'DATABASE_URL no está configurada.' });
  const { entrepreneurId, productId, quantity, soldAt } = req.body || {};
  if (!entrepreneurId || !productId || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
    return res.status(400).json({ error: 'Emprendedora, producto y cantidad válida son obligatorios.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const product = await client.query('SELECT id,name,price,stock FROM products WHERE id=$1 AND entrepreneur_id=$2 FOR UPDATE', [productId, entrepreneurId]);
    if (!product.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Producto no encontrado.' }); }
    if (product.rows[0].stock < Number(quantity)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'No hay existencias suficientes.' }); }
    const p = product.rows[0];
    await client.query('UPDATE products SET stock=stock-$1, updated_at=NOW() WHERE id=$2', [Number(quantity), productId]);
    const result = await client.query(
      'INSERT INTO sales (entrepreneur_id,product_id,product_name,quantity,unit_price,total,sold_at) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,NOW())) RETURNING *',
      [entrepreneurId, productId, p.name, Number(quantity), p.price, Number(p.price) * Number(quantity), soldAt || null]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); next(e); }
  finally { client.release(); }
});

app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error interno. Consulta los registros del servidor.' });
});

const server = app.listen(PORT, '0.0.0.0', () => console.log(`Mujer Emprendedora escuchando en el puerto ${PORT}`));
async function shutdown() { server.close(); if (pool) await pool.end(); process.exit(0); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
