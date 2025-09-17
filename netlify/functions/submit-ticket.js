// Netlify Function -> AppSheet: Add a row to "Tickets"
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { form } = JSON.parse(event.body || '{}') || {};
    if (!form || typeof form !== 'object') {
      return { statusCode: 400, body: 'Missing form payload' };
    }

    // ---- ENV (set in Netlify UI) ----
    const {
      APPSHEET_APP_ID,           // e.g. 47c21a86-76f7-419c-886b-8f7be00bd90a
      APPSHEET_ACCESS_KEY,       // your Application Access Key
      APPSHEET_TABLE = 'Tickets',
      APPSHEET_REGION = 'www.appsheet.com' // or eu.appsheet.com / asia-southeast.appsheet.com
    } = process.env;

    if (!APPSHEET_APP_ID || !APPSHEET_ACCESS_KEY) {
      return { statusCode: 500, body: 'Server not configured (AppSheet env vars missing)' };
    }

    // Build AppSheet request
    const url = `https://${APPSHEET_REGION}/api/v2/apps/${encodeURIComponent(APPSHEET_APP_ID)}/tables/${encodeURIComponent(APPSHEET_TABLE)}/Action`;

    // NOTE: AppSheet expects the action wrapper below
    const body = {
      Action: "Add",
      Properties: {
        Locale: "en-US",
        Timezone: "America/Chicago",
        // Optional: pass through user identity for auditing if desired
        // UserId: form.Email || ""
      },
      Rows: [
        {
          // Send everything; columns that match will be written, others ignored.
          // Tip: Make your AppSheet column names match these keys.
          ...form,
          Timestamp: new Date().toISOString() // if your table has a Timestamp column
        }
      ]
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'ApplicationAccessKey': APPSHEET_ACCESS_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const text = await resp.text();
    if (!resp.ok) {
      return { statusCode: resp.status, body: text || 'AppSheet API error' };
    }

    // AppSheet returns the inserted row(s)
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: text };

  } catch (err) {
    return { statusCode: 500, body: `Error: ${err.message}` };
  }
};
