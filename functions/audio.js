// Securely verifies the session token
async function verifySessionToken(token, secret) {
  if (!token || !token.startsWith('session_') || !token.includes('.')) {
    return false;
  }
  const [data, providedSignature] = token.split('.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expectedSignatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const expectedSignature = Array.from(new Uint8Array(expectedSignatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return providedSignature === expectedSignature;
}

export async function onRequest(context) {
  const { env, request } = context;

  // The Live API requires a WebSocket upgrade request
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader !== "websocket") {
    return new Response("Expected WebSocket Connection", { status: 426 });
  }

  // Extract tokens from query parameters during the WebSocket Handshake
  const url = new URL(request.url);
  const sessionToken = url.searchParams.get("sessionToken");
  const turnstileToken = url.searchParams.get("turnstileToken");

  let isAuthorized = false;

  if (sessionToken) {
    isAuthorized = await verifySessionToken(sessionToken, env.TURNSTILE_SECRET_KEY); 
  } else if (turnstileToken) {
    const formData = new FormData();
    formData.append('secret', env.TURNSTILE_SECRET_KEY);
    formData.append('response', turnstileToken);
    const verifyResult = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: formData });
    const verifyData = await verifyResult.json();
    isAuthorized = verifyData.success;
  }

  if (!isAuthorized) {
    return new Response("Unauthorized", { status: 403 });
  }

  return new Response(JSON.stringify({
    error: "Real-time voice is unavailable because it requires a model outside the configured Gemma and Flash-Lite set."
  }), {
    status: 503,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
