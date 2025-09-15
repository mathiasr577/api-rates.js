// /api/rates.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    res.setHeader('Cache-Control', 'no-store');

    const apiKey = process.env.EASYPOST_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing EASYPOST_API_KEY' });

    const body = (req.body && typeof req.body === 'string') ? JSON.parse(req.body) : (req.body || {});

    // ---------------------------
    // Normalizadores práctico-utilitarios
    // ---------------------------
    const COUNTRY_MAP = {
      'united states': 'US', 'usa': 'US', 'eeuu': 'US', 'estados unidos': 'US',
      'méxico': 'MX', 'mexico': 'MX',
      'colombia': 'CO',
      'canadá': 'CA', 'canada': 'CA'
    };
    const US_STATE_MAP = {
      'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA','north carolina':'NC','carolina del norte':'NC',
      'south carolina':'SC','carolina del sur':'SC','colorado':'CO','connecticut':'CT','north dakota':'ND','dakota del norte':'ND',
      'south dakota':'SD','dakota del sur':'SD','delaware':'DE','district of columbia':'DC','distrito de columbia':'DC','dc':'DC',
      'florida':'FL','georgia':'GA','hawaii':'HI','hawái':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS',
      'kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA','michigan':'MI','minnesota':'MN',
      'mississippi':'MS','missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV','new hampshire':'NH','nuevo hampshire':'NH',
      'new jersey':'NJ','nuevo jersey':'NJ','new mexico':'NM','nuevo méxico':'NM','new york':'NY','nueva york':'NY','ohio':'OH',
      'oklahoma':'OK','oregon':'OR','pennsylvania':'PA','rhode island':'RI','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT',
      'virginia':'VA','washington':'WA','west virginia':'WV','virginia occidental':'WV','wisconsin':'WI','wyoming':'WY'
    };

    const normalizeCountry = (val) => {
      if (!val) return 'US';
      if (typeof val === 'string') {
        const t = val.trim();
        if (t.length === 2) return t.toUpperCase();
        const key = t.toLowerCase();
        return COUNTRY_MAP[key] || 'US';
      }
      return 'US';
    };

    const normalizeState = (country, val) => {
      if (!val) return '';
      if (country !== 'US') {
        // Para otros países asume ya viene código
        return ('' + val).trim().toUpperCase();
      }
      const t = ('' + val).trim();
      if (t.length === 2) return t.toUpperCase();
      const key = t.toLowerCase();
      return US_STATE_MAP[key] || t.toUpperCase();
    };

    // Parser “por compatibilidad” del formato viejo "calle, ciudad, ST ZIP, país"
    const parseLine = (line) => {
      const s = (typeof line === 'string') ? line : '';
      const parts = s.split(',').map(x => x.trim());
      const street1 = parts[0] || '';
      const city    = parts[1] || '';
      let state = '', zip = '', country = 'US';
      if (parts[2]) {
        // "FL 33056"
        const m = parts[2].match(/([A-Za-z]{2})\s+(\d{4,10})/);
        if (m) { state = m[1]; zip = m[2]; }
      }
      if (parts[3]) country = parts[3];
      return { street1, city, state, zip, country };
    };

    // 1) Formato nuevo recomendado
    let from = body.from;
    let to   = body.to;

    // 2) Compatibilidad con formato viejo si no vino el nuevo
    if (!from && body.origin)      from = parseLine(body.origin);
    if (!to   && body.destination) to = parseLine(body.destination);

    // Normaliza país/estado y asegura strings
    const fixAddress = (a) => {
      if (!a) return a;
      const country = normalizeCountry(a.country);
      const state   = normalizeState(country, a.state);
      return {
        street1: (a.street1 || '').toString(),
        city:    (a.city    || '').toString(),
        state,
        zip:     (a.zip     || '').toString(),
        country
      };
    };
    from = fixAddress(from);
    to   = fixAddress(to);

    // Validación fuerte (no hacemos “suposiciones”)
    const missing = [];
    const need = (obj, label) => {
      if (!obj) { missing.push(label); return; }
      ['street1','city','state','zip','country'].forEach(k => { if (!obj[k]) missing.push(`${label}.${k}`); });
    };
    need(from, 'from'); need(to, 'to');

    const parcelIn = body.parcel || {};
    const weightKg = Number(parcelIn.weight_kg ?? parcelIn.weight ?? 0);
    const lengthCm = Number(parcelIn.length_cm ?? parcelIn.length ?? 0);
    const widthCm  = Number(parcelIn.width_cm  ?? parcelIn.width  ?? 0);
    const heightCm = Number(parcelIn.height_cm ?? parcelIn.height ?? 0);
    if (!weightKg || !lengthCm || !widthCm || !heightCm) {
      missing.push('parcel.weight_kg/length_cm/width_cm/height_cm');
    }

    if (missing.length) {
      return res.status(400).json({ error: 'PARAMS_MISSING', missing });
    }

    // Unidades de EasyPost
    const ounces = Math.max(0.1, weightKg) * 35.274;
    const inches = (cm) => Number(cm) / 2.54;

    const shipment = {
      to_address:   to,
      from_address: from,
      parcel: {
        weight: ounces,
        length: inches(lengthCm),
        width:  inches(widthCm),
        height: inches(heightCm),
      },
      options: { currency: 'USD' },
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

    const rates = (data.rates || [])
      .map(r => ({
        id: r.id,
        carrier: r.carrier,
        service: r.service,
        rate: Number(r.rate),
        currency: r.currency,
        est_days: r.delivery_days ?? null,
        est_date: r.delivery_date ?? null,
        billing_type: r.billing_type ?? null,
        mode: data.mode || 'test'
      }))
      .sort((a,b) => a.rate - b.rate);

    return res.status(200).json({
      shipment_id: data.id,
      mode: data.mode,
      from, to,
      parcel: { weight_kg: weightKg, length_cm: lengthCm, width_cm: widthCm, height_cm: heightCm },
      rates
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: String(err?.message || err) });
  }
}
