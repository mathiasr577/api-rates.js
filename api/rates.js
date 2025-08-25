export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { origin = '', destination = '', parcel = {} } = req.body || {};
    const apiKey = process.env.EASYPOST_API_KEY;
    if (!apiKey) return res.status(500).send('Missing EASYPOST_API_KEY');

    // Conversión a unidades que pide EasyPost
    const weightOz = Math.max(1, Math.round((Number(parcel.weight_kg) || 0.1) * 35.274)); // kg -> oz
    const lenIn = Number(parcel.length_cm) ? Number(parcel.length_cm) / 2.54 : undefined;  // cm -> in
    const widIn = Number(parcel.width_cm) ? Number(parcel.width_cm) / 2.54 : undefined;
    const heiIn = Number(parcel.height_cm) ? Number(parcel.height_cm) / 2.54 : undefined;

    // ¡IMPORTANTE!: envolver todo dentro de "shipment"
    const shipment = {
      to_address:   { street1: String(destination).trim() },
      from_address: { street1: String(origin).trim() },
      parcel: {
        weight: weightOz,
        ...(lenIn ? { length: lenIn } : {}),
        ...(widIn ? { width: widIn } : {}),
        ...(heiIn ? { height: heiIn } : {}),
      },
    };

    const resp = await fetch('https://api.easypost.com/v2/shipments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      },
      body: JSON.stringify({ shipment }),
    });

    const data = await resp.json();
    return res.status(resp.ok ? 200 : resp.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: String(err) });
  }
}
