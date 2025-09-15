<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AhorraYa – Comparador</title>
  <style>
    :root { color-scheme: dark; }
    body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#0b0f14;color:#e6edf3;margin:0;padding:24px}
    h1{margin:0 0 20px 0}
    .grid{display:grid;gap:18px}
    .two{grid-template-columns:1fr 1fr}
    .card{background:#0f1520;border:1px solid #1c2330;border-radius:14px;padding:16px}
    .row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    label{font-size:13px;color:#9fb0c3;margin-bottom:6px;display:block}
    input, select{width:100%;background:#0c1220;border:1px solid #243042;color:#e6edf3;border-radius:10px;padding:10px 12px;font-size:14px;outline:none}
    input:focus,select:focus{border-color:#ff7a00}
    .btn{background:#ff7a00;border:none;color:#101418;padding:14px 16px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;width:100%}
    .btn:disabled{opacity:.6;cursor:not-allowed}
    .rates{margin-top:16px}
    .rate{display:flex;align-items:center;justify-content:space-between;background:#0c1220;border:1px solid #223049;border-radius:12px;padding:12px 14px;margin-top:10px}
    .left{display:flex;gap:12px;align-items:center}
    .logo{width:28px;height:28px;border-radius:6px;display:grid;place-items:center;font-size:12px;font-weight:800}
    .usps{background:#2b6cb0}
    .ups{background:#6b4f1d}
    .fedex{background:#5b21b6}
    .tag{font-size:11px;color:#a6b3c5;border:1px solid #304055;border-radius:999px;padding:2px 8px;margin-left:8px}
    .price{font-weight:800}
    pre{background:#0c1220;border:1px dashed #2b3a4f;border-radius:12px;padding:14px;white-space:pre-wrap}
  </style>
</head>
<body>
  <h1>AhorraYa</h1>

  <div class="grid two">
    <!-- ORIGEN -->
    <div class="card">
      <h3>Origen</h3>
      <div class="row">
        <div>
          <label>Calle</label>
          <input id="fromStreet" placeholder="20102 NW 27th Cir" value="20102 NW 27th Cir">
        </div>
        <div>
          <label>Ciudad</label>
          <input id="fromCity" placeholder="Miami Gardens" value="Miami Gardens">
        </div>
        <div>
          <label>Estado/Provincia</label>
          <select id="fromState">
            <option value="FL" selected>Florida</option>
            <option value="CA">California</option>
            <option value="NY">New York</option>
            <option value="TX">Texas</option>
          </select>
        </div>
        <div>
          <label>ZIP / Código postal</label>
          <input id="fromZip" placeholder="33056" value="33056">
        </div>
      </div>
      <div class="row" style="grid-template-columns:1fr 1fr">
        <div>
          <label>País</label>
          <select id="fromCountry">
            <option value="US" selected>Estados Unidos</option>
            <option value="MX">México</option>
            <option value="CO">Colombia</option>
            <option value="CA">Canadá</option>
          </select>
        </div>
      </div>
    </div>

    <!-- DESTINO -->
    <div class="card">
      <h3>Destino</h3>
      <div class="row">
        <div>
          <label>Calle</label>
          <input id="toStreet" placeholder="1101 Brickell Ave" value="1101 Brickell Ave">
        </div>
        <div>
          <label>Ciudad</label>
          <input id="toCity" placeholder="Miami" value="Miami">
        </div>
        <div>
          <label>Estado/Provincia</label>
          <select id="toState">
            <option value="FL" selected>Florida</option>
            <option value="CA">California</option>
            <option value="NY">New York</option>
            <option value="TX">Texas</option>
          </select>
        </div>
        <div>
          <label>ZIP / Código postal</label>
          <input id="toZip" placeholder="33131" value="33131">
        </div>
      </div>
      <div class="row" style="grid-template-columns:1fr 1fr">
        <div>
          <label>País</label>
          <select id="toCountry">
            <option value="US" selected>Estados Unidos</option>
            <option value="MX">México</option>
            <option value="CO">Colombia</option>
            <option value="CA">Canadá</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  <!-- PAQUETE + BOTÓN -->
  <div class="card" style="margin-top:18px">
    <h3>Paquete</h3>
    <div class="row">
      <div>
        <label>Peso (kg)</label>
        <input id="weightKg" value="2.5" inputmode="decimal">
      </div>
      <div>
        <label>Largo (cm)</label>
        <input id="lengthCm" value="30" inputmode="decimal">
      </div>
      <div>
        <label>Ancho (cm)</label>
        <input id="widthCm" value="20" inputmode="decimal">
      </div>
      <div>
        <label>Alto (cm)</label>
        <input id="heightCm" value="10" inputmode="decimal">
      </div>
    </div>
    <div style="margin-top:14px">
      <button id="searchBtn" class="btn">Consultar tarifas reales</button>
    </div>

    <div id="results" class="rates"></div>
    <pre id="debug" style="display:none"></pre>
  </div>

  <script>
    const $ = (id) => document.getElementById(id);

    const carrierLogo = (name) => {
      const key = (name || '').toLowerCase();
      if (key.includes('ups'))   return '<div class="logo ups">UPS</div>';
      if (key.includes('fedex')) return '<div class="logo fedex">FX</div>';
      return '<div class="logo usps">USPS</div>';
    };

    function renderRates(payload, data) {
      const wrap = $('results');
      wrap.innerHTML = '';
      (data.rates || []).forEach(r => {
        const row = document.createElement('div');
        row.className = 'rate';
        row.innerHTML = `
          <div class="left">
            ${carrierLogo(r.carrier)}
            <div>
              <div><strong>${r.carrier}</strong> · ${r.service} ${r.mode ? `<span class="tag">${r.mode}</span>`:''}</div>
              <div style="font-size:12px;color:#9fb0c3">
                ${r.est_days ? `Entrega: ${r.est_days} días` : (r.est_date ? `Entrega: ${r.est_date}` : '—')}
              </div>
            </div>
          </div>
          <div class="price">$${r.rate.toFixed(2)}</div>
        `;
        wrap.appendChild(row);
      });
      if ((data.rates || []).length === 0) {
        wrap.innerHTML = '<div class="rate"><div>Sin tarifas disponibles para esos datos.</div></div>';
      }
      // debug opcional
      const dbg = $('debug');
      dbg.style.display = 'block';
      dbg.textContent = JSON.stringify({ sent: payload, received: data }, null, 2);
    }

    $('searchBtn').addEventListener('click', async () => {
      const btn = $('searchBtn');
      btn.disabled = true; btn.textContent = 'Consultando...';
      $('results').innerHTML = ''; $('debug').style.display='none';

      const payload = {
        from: {
          street1: $('fromStreet').value.trim(),
          city:    $('fromCity').value.trim(),
          state:   $('fromState').value.trim(),
          zip:     $('fromZip').value.trim(),
          country: $('fromCountry').value
        },
        to: {
          street1: $('toStreet').value.trim(),
          city:    $('toCity').value.trim(),
          state:   $('toState').value.trim(),
          zip:     $('toZip').value.trim(),
          country: $('toCountry').value
        },
        parcel: {
          weight_kg: Number($('weightKg').value),
          length_cm: Number($('lengthCm').value),
          width_cm:  Number($('widthCm').value),
          height_cm: Number($('heightCm').value),
        }
      };

      try {
        const resp = await fetch('/api/rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (!resp.ok) {
          $('results').innerHTML = `<pre>${JSON.stringify(data,null,2)}</pre>`;
        } else {
          renderRates(payload, data);
        }
      } catch (e) {
        $('results').innerHTML = `<pre>${String(e)}</pre>`;
      } finally {
        btn.disabled = false; btn.textContent = 'Consultar tarifas reales';
      }
    });
  </script>
</body>
</html>
