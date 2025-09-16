// netlify/functions/submit-ticket.js
const { randomUUID } = require('crypto');

const cors = (origin = '*') => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

exports.handler = async (event) => {
  const ORIGIN = process.env.ALLOWED_ORIGIN || '*';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(ORIGIN), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(ORIGIN), body: 'Use POST' };
  }

  try {
    const p = JSON.parse(event.body || '{}');

    if (!p.email || !p.name) {
      return { statusCode: 200, headers: cors(ORIGIN), body: JSON.stringify({ ok:false, error:'Name + Email required' }) };
    }

    // --- Generate the key the table expects ---
    const ticketId = randomUUID(); // e.g., '8b2a3b4e-...'
    // If your key column is NOT literally "TicketID", change the property name below to match.

    const priorityMap = { Low:'P3 - Low', Medium:'P2 - Medium', High:'P1 - High', 'On-site':'P0 - Critical' };

    // Map to your exact column names
    const row = {
      TicketID: ticketId,                         // <-- supply the required key
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

      // If ActiveAlarms is Text (not EnumList), change to .join(', ')
      ActiveAlarms: Array.isArray(p.alarms) ? p.alarms : [],

      Description: (p.description || '').trim(),
      CreatedAt: new Date().toISOString(),
    };

    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;
    const tableName = process.env.TABLE_NAME || 'Tickets';

    const url = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(tableName)}/Action`;
    const body = { Action:'Add', Properties:{ Locale:'en-US' }, Rows:[row] };

    const apiRes = await fetch(url, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Accept':'application/json',
        'ApplicationAccessKey': accessKey,
      },
      body: JSON.stringify(body),
    });

    const text = await apiRes.text();
    console.log('AppSheet status:', apiRes.status);
    console.log('Row we attempted:', JSON.stringify(row));
    console.log('AppSheet body:', text || '(empty)');

    let json = null;
    try { json = JSON.parse(text); } catch (_) {}

    if (!apiRes.ok) {
      return { statusCode:200, headers: cors(ORIGIN), body: JSON.stringify({ ok:false, error:`AppSheet ${apiRes.status}: ${text}` }) };
    }

    const bodyErrors =
      (json && (json.Errors || json.errors)) ||
      (json && json.Rows && json.Rows[0] && json.Rows[0].Errors);

    if (Array.isArray(bodyErrors) && bodyErrors.length) {
      return { statusCode:200, headers: cors(ORIGIN), body: JSON.stringify({ ok:false, error: bodyErrors.join('; ') }) };
    }

    return { statusCode:200, headers: cors(ORIGIN), body: JSON.stringify({ ok:true, id: ticketId }) };

  } catch (err) {
    console.error('Submit error:', err);
    return { statusCode:200, headers: cors(ORIGIN), body: JSON.stringify({ ok:false, error:String(err) }) };
  }
};
