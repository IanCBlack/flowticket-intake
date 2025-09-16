const apiRes = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'ApplicationAccessKey': accessKey,
  },
  body: JSON.stringify(body),
});

const text = await apiRes.text();
let json;
try { json = JSON.parse(text); } catch { json = null; }

// Log to Netlify → Deploys → Functions logs (handy for debugging)
console.log('AppSheet status:', apiRes.status);
console.log('AppSheet body:', text);

// If HTTP not OK, bubble it up
if (!apiRes.ok) {
  return {
    statusCode: 200,
    headers: cors(ORIGIN),
    body: JSON.stringify({ ok: false, error: `AppSheet ${apiRes.status}: ${text}` }),
  };
}

// If body contains errors, bubble those up too
const bodyErrors =
  (json && json.Errors) ||
  (json && json.errors) ||
  (json && json.Rows && json.Rows[0] && json.Rows[0].Errors);

if (bodyErrors && bodyErrors.length) {
  return {
    statusCode: 200,
    headers: cors(ORIGIN),
    body: JSON.stringify({ ok: false, error: bodyErrors.join('; ') }),
  };
}

// Otherwise, success
return {
  statusCode: 200,
  headers: cors(ORIGIN),
  body: JSON.stringify({ ok: true, result: json }),
};
