// db.js — Conexión a TiDB Cloud (protocolo MySQL)
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.TIDB_HOST,
  port: Number(process.env.TIDB_PORT || 4000),
  user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  // TiDB Cloud Serverless exige TLS
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
});

module.exports = pool;
