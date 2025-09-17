// netlify/functions/submit-ticket.js
const { randomInt } = require('crypto');

const cors = (origin = '*') => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

// 8-char uppercase letters + digits (similar to AppSheet UNIQUEID())
function uniqueId8() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[randomInt(0, alphabet.length)];
  return out;
}

exports.handler = async (event) => {
  const ORIGIN = process.env.ALLOWED_ORIGIN || '*';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(ORIGIN), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(ORIGIN), body: 'Use POST' };
  }

  try {
    // Only send the key for now
    const ticketId = uniqueId8();
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

    return { statusCode: 200, headers: cors(ORIGIN), body: JSON.stringify({ ok:true, id: ticketId }) };
  } catch (err) {
    console.error('Submit error:', err);
    return { statusCode: 200, headers: cors(ORIGIN), body: JSON.stringify({ ok:false, error:String(err) }) };
  }
};
