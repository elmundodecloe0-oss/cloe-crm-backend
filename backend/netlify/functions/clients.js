// GET  /api/clients            -> lista todos los clientes con su saldo
// GET  /api/clients?id=5       -> detalle de un cliente + sus pedidos y pagos
// POST /api/clients             -> crea un cliente  { name, phone, address }

const { getPool, json, isPreflight } = require('./_db');

exports.handler = async (event) => {
  if (isPreflight(event)) return json(200, {});
  const pool = getPool();

  try {
    if (event.httpMethod === 'GET') {
      const id = event.queryStringParameters && event.queryStringParameters.id;

      if (id) {
        // --- Detalle de un cliente ---
        const [[client]] = await pool.query('SELECT * FROM clients WHERE id = ?', [id]);
        if (!client) return json(404, { error: 'Cliente no encontrado' });

        const [orders] = await pool.query(
          `SELECT o.*, ob.paid, ob.balance_due
           FROM orders o
           JOIN order_balances ob ON ob.order_id = o.id
           WHERE o.client_id = ?
           ORDER BY o.order_date DESC`,
          [id]
        );

        for (const order of orders) {
          const [items] = await pool.query(
            'SELECT id, description, quantity, unit_price, subtotal FROM order_items WHERE order_id = ?',
            [order.id]
          );
          order.items = items;
        }

        const [payments] = await pool.query(
          `SELECT * FROM payments WHERE client_id = ? ORDER BY payment_date DESC LIMIT 20`,
          [id]
        );

        const [[balance]] = await pool.query(
          'SELECT total_ordered, total_paid, balance_due FROM client_balances WHERE client_id = ?',
          [id]
        );

        return json(200, { client, orders, payments, balance: balance || { total_ordered: 0, total_paid: 0, balance_due: 0 } });
      }

      // --- Lista de todos los clientes con saldo ---
      const [rows] = await pool.query(
        `SELECT c.id, c.name, c.phone, c.address,
                COALESCE(cb.total_ordered,0) AS total_ordered,
                COALESCE(cb.total_paid,0)    AS total_paid,
                COALESCE(cb.balance_due,0)   AS balance_due
         FROM clients c
         LEFT JOIN client_balances cb ON cb.client_id = c.id
         ORDER BY balance_due DESC, c.name ASC`
      );
      return json(200, { clients: rows });
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { name, phone, address, notes } = body;
      if (!name || !name.trim()) return json(400, { error: 'El nombre es obligatorio' });

      const [result] = await pool.query(
        'INSERT INTO clients (name, phone, address, notes) VALUES (?, ?, ?, ?)',
        [name.trim(), phone || null, address || null, notes || null]
      );
      return json(201, { id: result.insertId, name, phone, address });
    }

    return json(405, { error: 'Método no permitido' });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Error del servidor', detail: err.message });
  }
};
