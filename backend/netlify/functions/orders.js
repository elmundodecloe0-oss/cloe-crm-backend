// POST /api/orders
// body: {
//   clientId, orderDate, paymentType: 'completo'|'contra_entrega'|'credito',
//   method: 'efectivo'|'transferencia'|'tarjeta'|'otro'   (solo si paymentType='completo')
//   items: [{ description, quantity, unitPrice }, ...]
// }
//
// Si paymentType es 'completo', además del pedido se crea automáticamente
// el pago por el total — igual que hace hoy la app en el navegador.

const { getPool, json, isPreflight } = require('./_db');

exports.handler = async (event) => {
  if (isPreflight(event)) return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });

  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    const body = JSON.parse(event.body || '{}');
    const { clientId, orderDate, paymentType, method, items } = body;

    if (!clientId) return json(400, { error: 'Falta clientId' });
    if (!Array.isArray(items) || items.length === 0) {
      return json(400, { error: 'El pedido necesita al menos un artículo' });
    }
    if (!['completo', 'contra_entrega', 'credito'].includes(paymentType)) {
      return json(400, { error: 'paymentType inválido' });
    }

    const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitPrice), 0);
    const date = orderDate || new Date().toISOString().slice(0, 10);

    await conn.beginTransaction();

    const [orderResult] = await conn.query(
      `INSERT INTO orders (client_id, order_date, payment_type, status, total)
       VALUES (?, ?, ?, 'pendiente', ?)`,
      [clientId, date, paymentType, total]
    );
    const orderId = orderResult.insertId;

    for (const it of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, description, quantity, unit_price)
         VALUES (?, ?, ?, ?)`,
        [orderId, it.description, it.quantity, it.unitPrice]
      );
    }

    let payment = null;
    if (paymentType === 'completo') {
      const payMethod = method || 'efectivo';
      const [payResult] = await conn.query(
        `INSERT INTO payments (order_id, client_id, amount, payment_date, method)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, clientId, total, date, payMethod]
      );
      await conn.query(`UPDATE orders SET status = 'saldado' WHERE id = ?`, [orderId]);
      payment = { id: payResult.insertId, orderId, amount: total, method: payMethod, date };
    }

    await conn.commit();
    return json(201, { orderId, total, payment });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return json(500, { error: 'Error del servidor', detail: err.message });
  } finally {
    conn.release();
  }
};
