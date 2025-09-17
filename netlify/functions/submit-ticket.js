// netlify/functions/submit-ticket.js
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
        body: JSON.stringify({ ok: false, error: 'Missing APPSHEET_APP_ID or APPSHEET_ACCESS_KEY env var' })
      };
    }

    const table = APPSHEET_TABLE || 'Tickets';

    // 8-char ID similar to your UNIQUEID() convention
    const ticketId = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

    // Only send columns that are guaranteed to exist. We’ll map more later.
    const appsheetBody = {
      Action: 'Add',
      Properties: {
        Locale: 'en-US'
      },
      Rows: [
        { TicketID: ticketId }
      ]
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
      return {
        statusCode: resp.status,
        body: JSON.stringify({ ok: false, error: text })
      };
    }

    // You can inspect the submitted form if needed:
    // const { form } = JSON.parse(event.body || '{}');

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, ticketId })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
