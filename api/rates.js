// /api/rates.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.EASYPOST_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing EASYPOST_API_KEY' });

    const { origin, destination, parcel } = req.body || {};
    // Validación mínima
    const need = (obj, keys) => keys.every(k => (obj?.[k] || '').toString().trim().length);
    if (!need(origin, ['street1','city','state','zip'])) {
      return res.status(400).json({ error: 'Origin incomplete (street1, city, state, zip required)' });
    }
    if (!need(destination, ['street1','city','state','zip'])) {
      return res.status(400).json({ error: 'Destination incomplete (street1, city, state, zip required)' });
    }

    // Conversión: kg -> oz, cm -> in
    const kg = Math.max(Number(parcel?.weight_kg) || 0, 0.1);
    const toOz = kg * 35.274;
    const toIn = (v) => Math.max(Number(v) || 0, 0) / 2.54;

    const body = {
      to_address: {
        street1: destination.street1,
        city: destination.city,
        state: destination.state,
        zip: destination.zip,
        country: destination.country || 'US',
      },
      from_address: {
        street1: origin.street1,
        city: origin.city,
        state: origin.state,
        zip: origin.zip,
        country: origin.country || 'US',
      },
      parcel: {
        weight: toOz,
        length: toIn(parcel?.length_cm || 0),
        width:  toIn(parcel?.width_cm  || 0),
        height: toIn(parcel?.height_cm || 0),
      }
    };

    const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64');

    const ep = await fetch('https://api.easypost.com/v2/shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': auth },
      body: JSON.stringify(body)
    });

    const data = await ep.json();
    if (!ep.ok) return res.status(ep.status).json({ error: 'EasyPost error', details: data });

    const shipment = data;
    const rates = (shipment.rates || [])
      .map(r => ({
        carrier: r.carrier,
        service: r.service,
        currency: r.currency,
        rate: Number(r.rate),
        retail_rate: r.retail_rate ? Number(r.retail_rate) : null,
        delivery_days: r.delivery_days ?? null,
        est_delivery_date: r.delivery_date ?? null,
        rate_id: r.id,
        carrier_account_id: r.carrier_account_id,
        shipment_id: shipment.id,
        mode: shipment.mode || 'test'
      }))
      .sort((a, b) => a.rate - b.rate);

    return res.status(200).json({ rates });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

