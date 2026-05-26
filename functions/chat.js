// A simple "VIP pass" generator
async function createSessionToken(secret) {
  const data = `session_${Date.now()}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const hashHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${data}.${hashHex}`;
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();
  const { messages, model, turnstileToken, sessionToken } = body;

  // 1. Check if they have a "VIP pass" (sessionToken) OR if it's a valid first-time verification
  let isAuthorized = false;

  // Logic: If sessionToken is provided, verify it. If not, verify Turnstile.
  if (sessionToken) {
    // Basic verification: Check if it's a valid session string
    isAuthorized = sessionToken.startsWith('session_'); 
  } else if (turnstileToken) {
    const formData = new FormData();
    formData.append('secret', env.TURNSTILE_SECRET_KEY);
    formData.append('response', turnstileToken);
    const verifyResult = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: formData });
    const verifyData = await verifyResult.json();
    isAuthorized = verifyData.success;
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
  }

  // 2. Call Gemini
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })) })
  });

  const data = await response.json();
  const newSessionToken = await createSessionToken(env.TURNSTILE_SECRET_KEY);

  // Send back the AI response AND the new session token
  return new Response(JSON.stringify({ ...data, sessionToken: newSessionToken }), {
    headers: { "Content-Type": "application/json" }
  });
}