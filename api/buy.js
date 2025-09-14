export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { shipment_id, rate_id } = req.body || {};
    if (!shipment_id || !rate_id) {
      return res.status(400).json({ error: 'shipment_id and rate_id are required' });
    }

    const apiKey = process.env.EASYPOST_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing EASYPOST_API_KEY' });

    const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64');

    const epResp = await fetch(`https://api.easypost.com/v2/shipments/${shipment_id}/buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth
      },
      body: JSON.stringify({ rate: { id: rate_id } })
    });

    const data = await epResp.json();

    if (!epResp.ok) {
      return res.status(epResp.status).json(data);
    }

    const label_url =
      data?.postage_label?.label_pdf_url ||
      data?.postage_label?.label_url ||
      data?.postage_label?.label_zpl_url ||
      null;

    return res.status(200).json({
      mode: data?.mode || 'test',
      label_url,
      tracking_code: data?.tracking_code || null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Buy error' });
  }
}
