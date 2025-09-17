// Netlify Function: adds a row to AppSheet "TechSupportRequestPortalSubmissions" table
// using 8-char uppercase UNIQUEID in column [ref_#]. You can override the table with APPSHEET_TABLE.
const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { APPSHEET_APP_ID, APPSHEET_ACCESS_KEY, APPSHEET_TABLE } = process.env;
    if (!APPSHEET_APP_ID || !APPSHEET_ACCESS_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: 'Missing APPSHEET_APP_ID or APPSHEET_ACCESS_KEY' })
      };
    }

    // Write to the new table by default; still overridable via env.
    const table = APPSHEET_TABLE || 'TechSupportRequestPortalSubmissions';

    // 8-char uppercase ID (UNIQUEID convention) for [ref_#]
    const refId = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

    // Optional: capture submitted form (not required by your ask, but harmless if sent).
    // If you prefer ONLY the key, you can ignore/par down this parsed body.
    let form = {};
    try {
      const parsed = JSON.parse(event.body || '{}');
      form = parsed.form || {};
    } catch { /* ignore parse errors */ }

    // Build the row. Required: [ref_#].
    // We include form fields as-is so AppSheet can map any matching columns you’ve created.
    const row = { 'ref_#': refId, ...form };

    const appsheetBody = {
      Action: 'Add',
      Properties: { Locale: 'en-US' },
      Rows: [ row ]
    };

    const url = `https://api.appsheet.com/api/v2/apps/${APPSHEET_APP_ID}/tables/${encodeURIComponent(table)}/Action`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ApplicationAccessKey': APPSHEET_ACCESS_KEY
      },
      body: JSON.stringify(appsheetBody)
    });

    const text = await resp.text();
    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ ok:false, error:text }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok:true, ref: refId }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: err.message }) };
  }
};
