'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'seating.db');
const HTML_PATH = path.join(ROOT, 'index.html');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS arrangements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    seat_to_student TEXT NOT NULL
  )
`);

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        req.destroy();
        reject(new Error('payload too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function listArrangements() {
  const rows = db.prepare('SELECT id, ts, seat_to_student FROM arrangements ORDER BY id ASC').all();
  return rows.map((row) => ({
    id: row.id,
    ts: row.ts,
    seatToStudent: JSON.parse(row.seat_to_student),
  }));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/') {
      const html = fs.readFileSync(HTML_PATH);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (url.pathname === '/api/history') {
      if (req.method === 'GET') {
        sendJson(res, 200, listArrangements());
        return;
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body || typeof body.ts !== 'number' || typeof body.seatToStudent !== 'object' || body.seatToStudent === null) {
          sendJson(res, 400, { error: 'invalid payload' });
          return;
        }
        const info = db
          .prepare('INSERT INTO arrangements (ts, seat_to_student) VALUES (?, ?)')
          .run(body.ts, JSON.stringify(body.seatToStudent));
        sendJson(res, 201, {
          id: Number(info.lastInsertRowid),
          ts: body.ts,
          seatToStudent: body.seatToStudent,
        });
        return;
      }

      if (req.method === 'DELETE') {
        db.exec('DELETE FROM arrangements');
        res.writeHead(204);
        res.end();
        return;
      }
    }

    const historyIdMatch = url.pathname.match(/^\/api\/history\/(\d+)$/);
    if (historyIdMatch && req.method === 'PUT') {
      const id = Number(historyIdMatch[1]);
      const body = await readJsonBody(req);
      if (!body || typeof body.seatToStudent !== 'object' || body.seatToStudent === null) {
        sendJson(res, 400, { error: 'invalid payload' });
        return;
      }
      const info = db
        .prepare('UPDATE arrangements SET seat_to_student = ? WHERE id = ?')
        .run(JSON.stringify(body.seatToStudent), id);
      if (info.changes === 0) {
        sendJson(res, 404, { error: 'not found' });
        return;
      }
      const row = db.prepare('SELECT id, ts, seat_to_student FROM arrangements WHERE id = ?').get(id);
      sendJson(res, 200, { id: row.id, ts: row.ts, seatToStudent: JSON.parse(row.seat_to_student) });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  } catch (err) {
    sendJson(res, 500, { error: String((err && err.message) || err) });
  }
});

server.listen(PORT, () => {
  console.log(`랜덤 자리 배치 서버 실행 중: http://localhost:${PORT}`);
  console.log(`데이터베이스 파일: ${DB_PATH}`);
});
