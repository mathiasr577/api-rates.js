// api/rates.js

// Helper: convierte una línea de dirección en el objeto que espera EasyPost
const toEPAddress = (line = '') => {
  // ZIP (12345 o 12345-6789)
  const zipMatch = line.match(/\b\d{5}(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[0] : undefined;

  // Busca "..., City, ST 12345"
  const cityState = line.match(/,\s*([^,]+?),\s*([A-Z]{2})\s*\d{5}/i);
  const city = cityState ? cityState[1].trim() : undefined;
  const state = cityState ? cityState[2].toUpperCase() : undefined;

  return {
    name: 'AhorraYa User',
    street1: line || '20102 NW 27th Cir',
    city: city || 'Miami Gardens',
    state: state || 'FL',
    zip: zip || '33056',
    country: 'US',
    phone: '7865719003',
    residential: true,
  };
};

// Helper: base64 para el header Basic Auth
const b64 = (s) =>
  Buffer.from(s, 'utf8').toString('base64');

// Helper: asegura números y unidades mínimas
const toOunces = (kg) => Math.max(0.1, Number(kg || 0)) * 35.274; // kg -> oz
const toInches = (cm) => Math.max(1, Number(cm || 0) / 2.54);     // cm -> in (min 1")

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.EASYPOST_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing EASYPOST_API_KEY' });
    }

    const { origin, destination, parcel } = req.body || {};

    // Construcción del shipment para EasyPost
    const body = {
      to_address: toEPAddress(destination),
      from_address: toEPAddress(origin),
      parcel: {
        weight: toOunces(parcel?.weight_kg ?? parcel?.weight),
        length: toInches(parcel?.length_cm ?? parcel?.length),
        width: toInches(parcel?.width_cm ?? parcel?.width),
        height: toInches(parcel?.height_cm ?? parcel?.height),
      },
      // Opcional: pedir tarifas en USD, etc.
      options: { currency: 'USD' },
    };

    // Llamada a EasyPost
    const epResp = await fetch('https://api.easypost.com/v2/shipments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${b64(`${apiKey}:`)}`,
      },
      body: JSON.stringify(body),
    });

    const data = await epResp.json();

    // Manejo de errores de EasyPost
    if (!epResp.ok) {
      return res.status(epResp.status).json({
        error: 'EasyPost error',
        details: data?.error || data,
      });
    }

    // Devuelve SOLO el arreglo de rates (tu UI muestra [] en crudo)
    const rates = Array.isArray(data?.rates) ? data.rates : (data?.shipment?.rates || []);
    return res.status(200).json(rates);
  } catch (err) {
    return res.status(500).json({
      error: 'Server error',
      message: err?.message || String(err),
    });
  }
}
