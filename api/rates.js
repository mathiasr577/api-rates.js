// api/rates.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const apiKey = process.env.EASYPOST_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'MISSING_EASYPOST_API_KEY' });
    }

    const { from = {}, to = {}, parcel = {} } = req.body || {};

    // Validación de campos requeridos
    const required = [
      'from.street1','from.city','from.state','from.zip','from.country',
      'to.street1','to.city','to.state','to.zip','to.country'
    ].filter(k => {
      const [a, b] = k.split('.');
      return !((req.body?.[a] || {})[b]);
    });

    if (required.length) {
      return res.status(400).json({ error: 'PARAMS_MISSING', missing: required });
    }

    // Conversión de unidades
    const weight_oz = Math.max(0.1, Number(parcel.weight_kg || 0)) * 35.274;
    const length_in = Number(parcel.length_cm || 0) / 2.54;
    const width_in  = Number(parcel.width_cm  || 0) / 2.54;
    const height_in = Number(parcel.height_cm || 0) / 2.54;

    const epBody = {
      to_address: {
        street1: to.street1,
        city: to.city,
        state: to.state,
        zip: to.zip,
        country: to.country
      },
      from_address: {
        street1: from.street1,
        city: from.city,
        state: from.state,
        zip: from.zip,
        country: from.country
      },
      parcel: {
        weight: weight_oz,
        length: length_in,
        width: width_in,
        height: height_in
      },
      options: { currency: 'USD' },
      is_return: false
    };

    const resp = await fetch('https://api.easypost.com/v2/shipments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(epBody)
    });

    // Intenta parsear JSON; si falla, toma texto
    const maybeJson = await resp.clone().json().catch(() => null);
    const payload = maybeJson ?? await resp.text();

    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'EasyPost error', details: payload });
    }

    // Formateo de tarifas
    const rates = (payload.rates || []).map(r => ({
      id: r.id,
      carrier: r.carrier,
      service: r.service,
      rate: Number(r.rate),
      currency: r.currency,
      est_days: r.delivery_days ?? null,
      est_date: r.delivery_date ?? null,
      mode: payload.mode || 'test'
    }));

    return res.status(200).json({
      shipment_id: payload.id,
      rates
    });
  } catch (err) {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: String(err?.message || err)
    });
  }
}
