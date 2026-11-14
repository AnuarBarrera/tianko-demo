import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "tianko-demo.sqlite");

export const DEMO_USER = {
  id: "d0000000-0000-0000-0000-000000000008",
  email: "ana@demo.tianko.mx",
  nombre: "Ana López",
};

export const DEMO_PRODUCTO = {
  id: "p0000000-0000-0000-0000-000000000001",
  puesto_id: "s0000000-0000-0000-0000-000000000001",
  puesto_nombre: "Antojitos Doña Lupe",
  vendor_id: "v0000000-0000-0000-0000-000000000001",
  nombre: "Quesadilla de flor de calabaza",
  precio: 35,
  unidad: "pieza",
  imagen_url: "/producto.jpg",
  stock: 20,
};

let _db: DatabaseSync | undefined;

export function db(): DatabaseSync {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  migrate(_db);
  seed(_db);
  return _db;
}

function migrate(d: DatabaseSync) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS productos (
      id TEXT PRIMARY KEY,
      puesto_id TEXT NOT NULL,
      puesto_nombre TEXT NOT NULL,
      vendor_id TEXT NOT NULL,
      nombre TEXT NOT NULL,
      precio REAL NOT NULL,
      unidad TEXT NOT NULL,
      imagen_url TEXT,
      stock INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS pedidos (
      id TEXT PRIMARY KEY,
      comprador_id TEXT NOT NULL,
      comprador_nombre TEXT,
      puesto_id TEXT NOT NULL,
      producto_id TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      total REAL NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pagos (
      id TEXT PRIMARY KEY,
      pedido_id TEXT NOT NULL UNIQUE,
      comprador_id TEXT NOT NULL,
      monto REAL NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      pey_id TEXT,
      qr_string TEXT,
      pey_transaction_id TEXT,
      monto_pagado REAL,
      pagado_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pagos_pey_id ON pagos(pey_id);
  `);
}

function seed(d: DatabaseSync) {
  d.prepare(
    `INSERT OR IGNORE INTO users (id, email, nombre) VALUES (?, ?, ?)`,
  ).run(DEMO_USER.id, DEMO_USER.email, DEMO_USER.nombre);

  d.prepare(
    `INSERT OR IGNORE INTO productos
      (id, puesto_id, puesto_nombre, vendor_id, nombre, precio, unidad, imagen_url, stock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    DEMO_PRODUCTO.id,
    DEMO_PRODUCTO.puesto_id,
    DEMO_PRODUCTO.puesto_nombre,
    DEMO_PRODUCTO.vendor_id,
    DEMO_PRODUCTO.nombre,
    DEMO_PRODUCTO.precio,
    DEMO_PRODUCTO.unidad,
    DEMO_PRODUCTO.imagen_url,
    DEMO_PRODUCTO.stock,
  );
}

export function newId(): string {
  return crypto.randomUUID();
}
