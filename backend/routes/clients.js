// routes/clients.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Listar todos los clientes con su saldo (usa la vista client_balances)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM client_balances ORDER BY balance_due DESC, client_name ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear cliente
router.post('/', async (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const [result] = await pool.query(
      `INSERT INTO clients (name, phone, address, notes) VALUES (?, ?, ?, ?)`,
      [name, phone || null, address || null, notes || null]
    );
    res.status(201).json({ id: result.insertId, name, phone, address, notes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detalle de un cliente: datos + pedidos + pagos + saldo
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [[client]] = await pool.query(`SELECT * FROM clients WHERE id = ?`, [id]);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    const [orders] = await pool.query(
      `SELECT * FROM order_balances WHERE client_id = ? ORDER BY order_date DESC`,
      [id]
    );
    for (const order of orders) {
      const [items] = await pool.query(
        `SELECT id, description, quantity, unit_price, subtotal FROM order_items WHERE order_id = ?`,
        [order.order_id]
      );
      order.items = items;
    }

    const [payments] = await pool.query(
      `SELECT * FROM payments WHERE client_id = ? ORDER BY payment_date DESC LIMIT 20`,
      [id]
    );

    const totalDue = orders.reduce((s, o) => s + Number(o.balance_due), 0);

    res.json({ client, orders, payments, totalDue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar cliente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, notes } = req.body;
    await pool.query(
      `UPDATE clients SET name=?, phone=?, address=?, notes=? WHERE id=?`,
      [name, phone || null, address || null, notes || null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
