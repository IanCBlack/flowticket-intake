// netlify/functions/submit-ticket.js

const cors = (origin='*') => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

exports.handler = async (event) => {
  const ORIGIN = process.env.ALLOWED_ORIGIN || '*';

  // Let the browser ask permission (CORS)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(ORIGIN), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(ORIGIN), body: 'Use POST' };
  }

  try {
    const p = JSON.parse(event.body || '{}');

    // Simple “is the form filled?” check
    if (!p.email || !p.name) {
      return { statusCode: 200, headers: cors(ORIGIN), body: JSON.stringify({ ok:false, error:'Name + Email required' }) };
    }

    // Turn form fields into an AppSheet row. (Make these names match your table!)
    const priorityMap = { Low:'P3 - Low', Medium:'P2 - Medium', High:'P1 - High', 'On-site':'P0 - Critical' };
    const row = {
      ReporterEmail: (p.email || '').trim(),
      ReporterCompany: (p.company || '').trim(),
      ReporterPhone: (p.phone || '').trim(),

      IntakeChannel: 'Web',
      Topic: p.topic || 'On-site Troubleshooting',
      Urgency: p.urgency || 'Medium',
      Priority: priorityMap[p.urgency] || 'P2 - Medium',
      Status: 'New',

      LocationName: (p.locationName || '').trim(),
      Series: (p.series || '').trim(),
      SerialNumber: (p.serialNumber || '').trim(),
      SoftwareVersion: (p.softwareVersion || '').trim(),
      ActiveAlarms: Array.isArray(p.alarms) ? p.alarms : [],
      Description: (p.description || '').trim(),

      CreatedAt: new Date().toISOString(),
    };

    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;
    const tableName = process.env.TABLE_NAME || 'Tickets';

    const url = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(tableName)}/Action`;
    const body = { Action:'Add', Properties:{ Locale:'en-US' }, Rows:[row] };

    const res = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'ApplicationAccessKey': accessKey },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      return { statusCode:200, headers: cors(ORIGIN), body: JSON.stringify({ ok:false, error:`AppSheet ${res.status}: ${text}` }) };
    }
    return { statusCode:200, headers: cors(ORIGIN), body: JSON.stringify({ ok:true }) };

  } catch (err) {
    return { statusCode:200, headers: cors(ORIGIN), body: JSON.stringify({ ok:false, error:String(err) }) };
  }
};
