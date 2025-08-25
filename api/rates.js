// /api/rates.js  (Next.js / Vercel API Route)

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.EASYPOST_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing EASYPOST_API_KEY' });
  }

  try {
    const { origin, destination, parcel } = req.body || {};
    if (!origin || !destination) {
      return res.status(400).json({ error: 'Faltan origen y/o destino' });
    }

    // ---- Conversiones ----
    // EasyPost espera peso en onzas (oz)
    const kg = Math.max(0.01, Number(parcel?.weight_kg || parcel?.weight || 1));
    const oz = kg * 35.27396195;

    // Dimensiones opcionales: si las pones en cm, se convierten a pulgadas
    const toInch = (v) => {
      const n = Number(v);
      return n && n > 0 ? n / 2.54 : undefined;
    };

    // ---- Shipment (MVP: USA -> USA) ----
    const shipment = {
      to_address:   { street1: String(destination), country: 'US' },
      from_address: { street1: String(origin),      country: 'US' },
      parcel: { weight: oz },
    };

    const L = toInch(parcel?.length_cm);
    const W = toInch(parcel?.width_cm);
    const H = toInch(parcel?.height_cm);
    if (L && W && H) {
      shipment.parcel.length = L;
      shipment.parcel.width  = W;
      shipment.parcel.height = H;
    }

    // ---- Llamada a EasyPost ----
    const epRes = await fetch('https://api.easypost.com/v2/shipments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
      },
      body: JSON.stringify({ shipment }), // <- IMPORTANTE: wrapper "shipment"
    });

    const data = await epRes.json();

    if (!epRes.ok) {
      // Pasa el error tal cual para ver qué falta
      return res.status(400).json({ error: 'EasyPost error', details: data });
    }

    // Normaliza tarifas
    const rates = Array.isArray(data?.rates)
      ? data.rates.map((r) => ({
          id: r.id,
          provider: r.carrier,
          service: r.service,
          amount: Number(r.rate),
          currency: r.currency,
          est_days: r.est_delivery_days ?? null,
          delivery_date: r.delivery_date ?? null,
        }))
      : [];

    return res.status(200).json({ rates, shipment_id: data.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
