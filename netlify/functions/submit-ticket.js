// netlify/functions/submit-ticket.js
const { randomUUID } = require('crypto');

const cors = (origin = '*') => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

exports.handler = async (event) => {
  const ORIGIN = process.env.ALLOWED_ORIGIN || '*';

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(ORIGIN), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(ORIGIN), body: 'Use POST' };
  }

  try {
    // Generate a key for [TicketID]
    const ticketId = randomUUID(); // if you prefer no dashes: .replace(/-/g, '')

    // Send ONLY the key (per your request)
    const row = { TicketID: ticketId };

    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;
    const tableName = process.env.TABLE_NAME || 'Tickets';

    const url = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(tableName)}/Action`;
    const body = { Action: 'Add', Properties: { Locale: 'en-US' }, Rows: [row] };

    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': accessKey },
      body: JSON.stringify(body),
    });

    const text = await apiRes.text();
    console.log('AppSheet status:', apiRes.status);
    console.log('Row attempted:', JSON.stringify(row));
    console.log('AppSheet body:', text || '(empty)');

    if (!apiRes.ok) {
      return { statusCode: 200, headers: cors(ORIGIN), body: JSON.stringify({ ok:false, error:`AppSheet ${apiRes.status}: ${text}` }) };
    }

    // Some API responses are empty on success—treat that as OK
    return { statusCode: 200, headers: cors(ORIGIN), body: JSON.stringify({ ok:true, id: ticketId }) };

  } catch (err) {
    console.error('Submit error:', err);
    return { statusCode: 200, headers: cors(ORIGIN), body: JSON.stringify({ ok:false, error:String(err) }) };
  }
};
