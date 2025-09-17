// Writes submissions to AppSheet table (env APPSHEET_TABLE), all as text/long text.
// Env: APPSHEET_APP_ID, APPSHEET_ACCESS_KEY, APPSHEET_TABLE (defaults to TechSupportRequestPortalSubmissions)

const crypto = require('crypto');

function make8() {
  if (crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase();
  }
  // Fallback if randomUUID isn’t available for any reason
  return Array.from(crypto.randomBytes(6))
    .map(b => (b & 0x1F).toString(36)).join('').slice(0,8).toUpperCase();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { APPSHEET_APP_ID, APPSHEET_ACCESS_KEY, APPSHEET_TABLE } = process.env;
    if (!APPSHEET_APP_ID || !APPSHEET_ACCESS_KEY) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'Missing APPSHEET_APP_ID or APPSHEET_ACCESS_KEY' }) };
    }
    const table = APPSHEET_TABLE || 'TechSupportRequestPortalSubmissions';

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch {}
    const form = body.form || {};

    const trim  = (v) => (v == null ? '' : String(v).trim());
    const lower = (v) => trim(v).toLowerCase();
    const normList = (v) => Array.isArray(v)
      ? v.map(trim).filter(Boolean).join(', ')
      : String(v || '').split(/[,\n\r]+/g).map(s=>s.trim()).filter(Boolean).join(', ');

    const ref = make8();

    const row = {
      'ref_#': ref,
      submitted_at: new Date().toISOString(),
      intake_channel: 'Tech Support Request Portal',
      ticket_type: 'External',

      // contact
      name: trim(form.name),
      email: lower(form.email),
      company: trim(form.company),
      phone: trim(form.phone),

      // top-level
      urgency: trim(form.urgency),
      category: trim(form.category),
      subject: trim(form.subject),
      description: trim(form.description),

      // flowsite type (when category = FlowSite Requests)
      frtype: trim(form.frtype),

      // On-Site
      locationName_ost: trim(form.locationName_ost),
      product_ost: trim(form.product_ost),
      serial_ost: trim(form.serial_ost),
      sw_ost: trim(form.sw_ost),
      alarms_ost: normList(form.alarms_ost),

      // Service
      locationName_sr: trim(form.locationName_sr),
      product_sr: trim(form.product_sr),
      serial_sr: trim(form.serial_sr),
      sw_sr: trim(form.sw_sr),

      // FlowSite (Diagnostics)
      locationName_fr: trim(form.locationName_fr),
      product_fr: trim(form.product_fr),
      serial_fr: trim(form.serial_fr),
      sw_fr: trim(form.sw_fr),

      // FlowSite (Add Systems)
      user_name_fr: trim(form.user_name_fr),
      user_email_fr: lower(form.user_email_fr),
      user_company_fr: trim(form.user_company_fr),
      user_phone_fr: trim(form.user_phone_fr),
      serials_for_access_fr: normList(form.serials_for_access_fr),

      // FlowSite (Other)
      other_desc_fr: trim(form.other_desc_fr),

      // SCADA
      locationName_sc: trim(form.locationName_sc),
      product_sc: trim(form.product_sc),
      serial_sc: trim(form.serial_sc),
      sw_sc: trim(form.sw_sc)
    };

    const payload = { Action:'Add', Properties:{ Locale:'en-US' }, Rows:[row] };

    const url = `https://api.appsheet.com/api/v2/apps/${APPSHEET_APP_ID}/tables/${encodeURIComponent(table)}/Action`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ApplicationAccessKey': APPSHEET_ACCESS_KEY
      },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    if (!resp.ok) return { statusCode: resp.status, body: JSON.stringify({ ok:false, error:text }) };

    return { statusCode: 200, body: JSON.stringify({ ok:true, ref }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: err.message }) };
  }
};
