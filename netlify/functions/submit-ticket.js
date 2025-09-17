const crypto = require('crypto');

function make8() {
  if (crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  }
  return Array.from(crypto.randomBytes(6))
    .map(b => (b & 0x1F).toString(36))
    .join('')
    .slice(0, 8)
    .toUpperCase();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { APPSHEET_APP_ID, APPSHEET_ACCESS_KEY, APPSHEET_TABLE } = process.env;
    const table = APPSHEET_TABLE || 'TechSupportRequestPortalSubmissions';

    if (!APPSHEET_APP_ID || !APPSHEET_ACCESS_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          error: 'Missing APPSHEET_APP_ID or APPSHEET_ACCESS_KEY',
        }),
      };
    }

    // Parse incoming form
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch {}
    const form = body.form || {};

    // Helpers
    const trim = (v) => (v == null ? '' : String(v).trim());
    const lower = (v) => trim(v).toLowerCase();
    const normList = (v) =>
      Array.isArray(v)
        ? v.map(trim).filter(Boolean).join(', ')
        : String(v || '')
            .split(/[,\n\r]+/g)
            .map((s) => s.trim())
            .filter(Boolean)
            .join(', ');

    // Generate key
    const ref = make8();

    // Build row – send both possible key names so either works
    const row = {
      'ref_#': ref,
      'Ref #': ref,

      submitted_at: new Date().toISOString(),
      intake_channel: 'Tech Support Request Portal',
      ticket_type: 'External',

      name: trim(form.name),
      email: lower(form.email),
      company: trim(form.company),
      phone: trim(form.phone),

      urgency: trim(form.urgency),
      category: trim(form.category),
      subject: trim(form.subject),
      description: trim(form.description),

      frtype: trim(form.frtype),

      locationName_ost: trim(form.locationName_ost),
      product_ost: trim(form.product_ost),
      serial_ost: trim(form.serial_ost),
      sw_ost: trim(form.sw_ost),
      alarms_ost: normList(form.alarms_ost),

      locationName_sr: trim(form.locationName_sr),
      product_sr: trim(form.product_sr),
      serial_sr: trim(form.serial_sr),
      sw_sr: trim(form.sw_sr),

      locationName_fr: trim(form.locationName_fr),
      product_fr: trim(form.product_fr),
      serial_fr: trim(form.serial_fr),
      sw_fr: trim(form.sw_fr),

      user_name_fr: trim(form.user_name_fr),
      user_email_fr: lower(form.user_email_fr),
      user_company_fr: trim(form.user_company_fr),
      user_phone_fr: trim(form.user_phone_fr),
      serials_for_access_fr: normList(form.serials_for_access_fr),

      other_desc_fr: trim(form.other_desc_fr),

      locationName_sc: trim(form.locationName_sc),
      product_sc: trim(form.product_sc),
      serial_sc: trim(form.serial_sc),
      sw_sc: trim(form.sw_sc),
    };

    const payload = {
      Action: 'Add',
      Properties: { Locale: 'en-US' },
      Rows: [row],
    };

    const url = `https://api.appsheet.com/api/v2/apps/${APPSHEET_APP_ID}/tables/${encodeURIComponent(
      table
    )}/Action`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ApplicationAccessKey: APPSHEET_ACCESS_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}

    // Consider any non-2xx OR any response containing Errors as failure
    const hasErrorsArray =
      Array.isArray(data) && data.some((r) => r && r.Errors && String(r.Errors).trim());
    const hasErrorsField =
      data && typeof data === 'object' && data.Errors && String(data.Errors).trim();

    if (!resp.ok || hasErrorsArray || hasErrorsField) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          table,
          ref,
          httpStatus: resp.status,
          response: data || text,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, table, ref, response: data || text }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
