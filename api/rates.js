// /api/rates.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // No caches, por si el CDN quiere ser listo
    res.setHeader('Cache-Control', 'no-store');

    const apiKey = process.env.EASYPOST_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing EASYPOST_API_KEY' });
    }

    const body = (req.body && typeof req.body === 'string') ? JSON.parse(req.body) : req.body || {};

    // 1) Acepta el formato nuevo: { from:{street1,city,state,zip,country}, to:{...}, parcel:{...} }
    let from = body.from;
    let to   = body.to;

    // 2) Compatibilidad con el formato viejo: { origin: "calle, ciudad, ST ZIP, país", destination: "..." }
    const parseLine = (line) => {
      // Simple parser de “calle, ciudad, ST ZIP, país”
      // Ej: "20102 NW 27th Cir, Miami Gardens, FL 33056, US"
      const parts = (line || '').split(',').map(s => s.trim());
      const street1 = parts[0] || '';
      const city    = parts[1] || '';
      let state = '', zip = '', country = 'US';
      if (parts[2]) {
        const m = parts[2].match(/([A-Za-z]{2})\s+(\d{4,10})/);
        if (m) { state = m[1]; zip = m[2]; }
      }
      if (parts[3]) country = parts[3].toUpperCase();
      return { street1, city, state, zip, country };
    };

    if (!from && body.origin) from = parseLine(body.origin);
    if (!to   && body.destination) to = parseLine(body.destination);

    // Valores por defecto de country si el usuario no lo puso
    if (from && !from.country) from.country = 'US';
    if (to   && !to.country)   to.country   = 'US';

    // Validación fuerte: nada de “usar por defecto” silencioso
    const missing = [];
    const need = (obj, label) => {
      if (!obj) { missing.push(label); return; }
      ['street1','city','state','zip','country'].forEach(k => { if (!obj[k]) missing.push(`${label}.${k}`); });
    };
    need(from, 'from'); need(to, 'to');

    const parcelIn = body.parcel || {};
    const weightKg  = Number(parcelIn.weight_kg  ?? parcelIn.weight ?? 0);
    const lengthCm  = Number(parcelIn.length_cm  ?? parcelIn.length ?? 0);
    const widthCm   = Number(parcelIn.width_cm   ?? parcelIn.width  ?? 0);
    const heightCm  = Number(parcelIn.height_cm  ?? parcelIn.height ?? 0);
    if (!weightKg || !lengthCm || !widthCm || !heightCm) {
      missing.push('parcel.weight_kg/length_cm/width_cm/height_cm');
    }

    if (missing.length) {
      return res.status(400).json({ error: 'PARAMS_MISSING', missing });
    }

    // Conversión a unidades de EasyPost
    const ounces = Math.max(0.1, weightKg) * 35.274;
    const inches = (cm) => Number(cm) / 2.54;

    const shipment = {
      to_address:   { street1: to.street1,   city: to.city,   state: to.state,   zip: to.zip,   country: to.country },
      from_address: { street1: from.street1, city: from.city, state: from.state, zip: from.zip, country: from.country },
      parcel: {
        weight: ounces, // oz
        length: inches(lengthCm),
        width:  inches(widthCm),
        height: inches(heightCm),
      },
      options: {
        // Para evitar cache de tarifas por parte de carriers/CDN
        // y marcar que es rating en tiempo real
        currency: 'USD',
      },
    };

    // Llamada a EasyPost
    const epResp = await fetch('https://api.easypost.com/v2/shipments', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ shipment }),
      cache: 'no-store'
    });

    const data = await epResp.json();

    if (!epResp.ok) {
      return res.status(epResp.status).json({ error: 'EasyPost error', details: data });
    }

    // data.rates es un array de tarifas de TODOS los carriers conectados
    const nice = (data.rates || [])
      .map(r => ({
        id: r.id,
        carrier: r.carrier,       // USPS, UPS, FedEx, etc.
        service: r.service,       // GroundAdvantage, Priority, etc.
        rate: Number(r.rate),     // precio en USD
        currency: r.currency,
        est_days: r.delivery_days ?? null,
        est_date: r.delivery_date ?? null,
        retail_rate: r.retail_rate ?? null,
        list_rate: r.list_rate ?? null,
        billing_type: r.billing_type ?? null,
        mode: data.mode || 'test'
      }))
      .sort((a,b) => a.rate - b.rate);

    return res.status(200).json({
      shipment_id: data.id,
      mode: data.mode,
      from, to,
      parcel: { weight_kg: weightKg, length_cm: lengthCm, width_cm: widthCm, height_cm: heightCm },
      rates: nice
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: String(err?.message || err) });
  }
}

