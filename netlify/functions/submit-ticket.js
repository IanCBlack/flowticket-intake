// netlify/functions/submit-ticket.js
// Inserts a full row into AppSheet "Tickets" based on your live form.
// Requires env vars: APPSHEET_APP_ID, APPSHEET_ACCESS_KEY (optional APPSHEET_TABLE).

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
    const table = APPSHEET_TABLE || 'Tickets';

    // Parse incoming payload
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
    const form = body.form || {};

    // Helpers
    const trim = (v) => (v == null ? '' : String(v).trim());
    const lower = (v) => trim(v).toLowerCase();
    const normList = (v) => {
      // Accept array OR string; split on commas/newlines; trim; drop empties; join with ", "
      if (Array.isArray(v)) {
        return v.map(trim).filter(Boolean).join(', ');
      }
      return String(v || '')
        .split(/[,\n\r]+/g)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(', ');
    };

    // Generate TicketID (8-char uppercase) — your standard
    const ticketId = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

    // Start row with static + top-of-form fields
    const row = {
      TicketID: ticketId,                                 // server key
      'Ticket Type': 'External',                          // static
      IntakeChannel: 'Tech Support Request Portal',       // static

      ReporterName: trim(form.name),
      ReporterEmail: lower(form.email),
      ReporterCompany: trim(form.company),
      ReporterPhone: trim(form.phone),

      Urgency: trim(form.urgency),                        // Low | Medium | High | On-site
      Category: trim(form.category),                      // exact labels
      Subject: trim(form.subject),
      Description: trim(form.description),

      // Pre-set defaults for shared fields (will fill based on category)
      Location: '',
      Product: '',
      DeviceSN: '',
      SoftwareVersion: '',

      // Category-specific extras (Text / LongText)
      ActiveAlarms: '',                                   // On-Site only
      FlowSiteRequestType: trim(form.frtype),
      FlowSiteUserName: '',
      FlowSiteUserEmail: '',
      FlowSiteUserCompany: '',
      FlowSiteUserPhoneNumber: '',
      ListofSerialNumbersforUsertoGainAccess: '',
      DescriptionofOtherFlowSiteRequest: ''
    };

    // Route shared fields based on category (Option A)
    const category = row.Category;

    if (category === 'On-Site Troubleshooting') {
      row.Location = trim(form.locationName_ost);
      row.Product = trim(form.product_ost);
      row.DeviceSN = trim(form.serial_ost);
      row.SoftwareVersion = trim(form.sw_ost);

      // Alarms: can arrive as array (preferred) or single string; normalize to "a, b"
      row.ActiveAlarms = normList(form.alarms_ost);
    }

    if (category === 'Service Request') {
      row.Location = trim(form.locationName_sr);
      row.Product = trim(form.product_sr);
      row.DeviceSN = trim(form.serial_sr);
      row.SoftwareVersion = trim(form.sw_sr);
      row.ActiveAlarms = ''; // blank for non On-Site
    }

    if (category === 'FlowSite Requests') {
      const frtype = row.FlowSiteRequestType;

      if (frtype === 'Diagnostics Assistance') {
        // Route into shared fields
        row.Location = trim(form.locationName_fr);
        row.Product = trim(form.product_fr);
        row.DeviceSN = trim(form.serial_fr);
        row.SoftwareVersion = trim(form.sw_fr);
      }

      if (
        frtype === 'Add Systems for New FlowSite User' ||
        frtype === 'Add Systems for Existing FlowSite User'
      ) {
        row.FlowSiteUserName = trim(form.user_name_fr);
        row.FlowSiteUserEmail = lower(form.user_email_fr);
        row.FlowSiteUserCompany = trim(form.user_company_fr);
        row.FlowSiteUserPhoneNumber = trim(form.user_phone_fr);
        row.ListofSerialNumbersforUsertoGainAccess = normList(form.serials_for_access_fr);
      }

      if (frtype === 'Other') {
        row.DescriptionofOtherFlowSiteRequest = trim(form.other_desc_fr);
      }

      row.ActiveAlarms = ''; // not used in FlowSite
    }

    if (category === 'SCADA/Comms') {
      row.Location = trim(form.locationName_sc);
      row.Product = trim(form.product_sc);
      row.DeviceSN = trim(form.serial_sc);
      row.SoftwareVersion = trim(form.sw_sc);
      row.ActiveAlarms = ''; // not used
    }

    if (category === 'Other') {
      // Leave shared fields as blanks by design
      row.ActiveAlarms = '';
    }

    // Build AppSheet payload
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
        ApplicationAccessKey: APPSHEET_ACCESS_KEY
      },
      body: JSON.stringify(appsheetBody)
    });

    const text = await resp.text();
    if (!resp.ok) {
      // Do not reject on missing fields per your instruction; just pass API error back
      return { statusCode: resp.status, body: JSON.stringify({ ok: false, error: text }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, ticketId }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
