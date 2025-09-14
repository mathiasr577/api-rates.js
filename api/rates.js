// api/rates.js

// ---- Helpers ----
const toB64 = (s) => Buffer.from(s, "utf8").toString("base64");

const toOunces = (kg) => Math.max(0.1, Number(kg || 0)) * 35.274; // kg -> oz
const toInches = (cm) => Math.max(1, Number(cm || 0) / 2.54);     // cm -> in (mín. 1")

// Convierte una línea de dirección a objeto EasyPost
const toEPAddress = (line = "") => {
  const zipMatch = line.match(/\b\d{5}(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[0] : undefined;
  const cityState = line.match(/,\s*([^,]+?),\s*([A-Z]{2})\s*\d{5}/i);
  const city = cityState ? cityState[1].trim() : undefined;
  const state = cityState ? cityState[2].toUpperCase() : undefined;

  return {
    name: "AhorraYa User",
    street1: line || "20102 NW 27th Cir",
    city: city || "Miami Gardens",
    state: state || "FL",
    zip: zip || "33056",
    country: "US",
    phone: "7865719003",
    residential: true,
  };
};

// ---- Handler ----
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.EASYPOST_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing EASYPOST_API_KEY" });
    }

    const { origin, destination, parcel } = req.body || {};

    // Cuerpo correcto: ¡va dentro de { shipment: ... }!
    const shipment = {
      to_address: toEPAddress(destination),
      from_address: toEPAddress(origin),
      parcel: {
        weight: toOunces(parcel?.weight_kg ?? parcel?.weight),
        length: toInches(parcel?.length_cm ?? parcel?.length),
        width: toInches(parcel?.width_cm ?? parcel?.width),
        height: toInches(parcel?.height_cm ?? parcel?.height),
      },
      options: { currency: "USD" },
    };

    const epResp = await fetch("https://api.easypost.com/v2/shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${toB64(`${apiKey}:`)}`,
      },
      body: JSON.stringify({ shipment }), // <--- clave
    });

    const data = await epResp.json();

    if (!epResp.ok) {
      // Devuelve el detalle crudo para depurar en el frontend
      return res.status(epResp.status).json({
        error: "EasyPost error",
        details: data?.error || data,
      });
    }

    // data.rates o data.shipment.rates, según versión de respuesta
    const rates = Array.isArray(data?.rates)
      ? data.rates
      : Array.isArray(data?.shipment?.rates)
      ? data.shipment.rates
      : [];

    // Ordenar por precio ascendente (opcional)
    rates.sort((a, b) => Number(a.rate) - Number(b.rate));

    return res.status(200).json(rates);
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      message: err?.message || String(err),
    });
  }
}

