export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { origin, destination, parcel } = req.body || {};
    const apiKey = process.env.EASYPOST_API_KEY;
    if (!apiKey) return res.status(500).send("Missing EASYPOST_API_KEY");

    const body = {
      to_address: { street1: destination },
      from_address: { street1: origin },
      parcel: {
        weight: Math.max(0.1, Number(parcel?.weight_kg || 1)) * 35.274, // kg -> oz
        length: Number(parcel?.length_cm || 0) / 2.54, // cm -> in
        width: Number(parcel?.width_cm || 0) / 2.54,
        height: Number(parcel?.height_cm || 0) / 2.54
      }
    };

    const resp = await fetch("https://api.easypost.com/v2/shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(apiKey + ":").toString("base64")
      },
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("EasyPost error", data);
      return res.status(400).json({ error: "EasyPost error", details: data });
    }

    const rates = (data?.rates || []).map(r => ({
      provider: r.carrier,
      service: r.service,
      amount: Number(r.rate),
      currency: r.currency,
      est_days: r.est_delivery_days ?? null
    }));

    res.status(200).json({ rates });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
}
