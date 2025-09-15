// api/rates.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.EASYPOST_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing EASYPOST_API_KEY' });
    }

    const { origin = {}, destination = {}, parcel = {} } = req.body || {};

    // Normaliza address
    const norm = (a = {}) => ({
      street1: a.street1 || a.line1 || a.address || '',
      city: (a.city || '').toString(),
      state: (a.state || a.region || '').toString(),
      zip: (a.zip || a.postal || a.postcode || '').toString(),
      country: (a.country || 'US').toString().toUpperCase(),
    });

    const from_address = norm(origin);
    const to_address = norm(destination);

    // Validación mínima
    const reqAddr = ad => ad.street1 && ad.city && ad.state && ad.zip && ad.country;
    if (!reqAddr(from_address) || !reqAddr(to_address)) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        details: 'Completa calle, ciudad, estado/provincia, ZIP y país en origen y destino.'
      });
    }

    // kg->oz y cm->in para EasyPost
    const kg = Number(parcel.weight_kg || parcel.weight || 0);
    const cmToIn = v => Math.max(0, Number(v || 0) / 2.54);
    const weightOz = Math.max(0.1, kg * 35.274);

    const epParcel = {
      weight: Number(weightOz.toFixed(2)),
      length: Number(cmToIn(parcel.length_cm).toFixed(2)),
      width: Number(cmToIn(parcel.width_cm).toFixed(2)),
      height: Number(cmToIn(parcel.height_cm).toFixed(2)),
    };

    // EasyPost requiere { shipment: { ... } }
    const shipment = { to_address, from_address, parcel: epParcel };

    const epResp = await fetch('https://api.easypost.com/v2/shipments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Mantengo Bearer, que es lo que venías usando
        'Authorization': `Bearer ${apiKey}`,
        // Si alguna vez te devuelve 401, cambia por Basic:
        // 'Authorization': 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64'),
      },
      body: JSON.stringify({ shipment }),
    });

    const data = await epResp.json();

    if (!epResp.ok) {
      return res.status(400).json({ error: 'EasyPost error', details: data });
    }

    const rates = (data?.rates || [])
      .map(r => ({
        rate_id: r.id,
        shipment_id: data.id,
        carrier: r.carrier,
        service: r.service,
        rate: r.rate,
        delivery_days: r.delivery_days,
        est_delivery_date: r.est_delivery_date,
        mode: data.mode,
      }))
      .sort((a, b) => Number(a.rate) - Number(b.rate));

    return res.status(200).json({ rates });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: String(err) });
  }
}
