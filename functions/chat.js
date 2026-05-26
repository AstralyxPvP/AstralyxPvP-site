// Helper: Create a 1-hour secure session token
async function createSessionToken(secret) {
  const exp = Date.now() + (1000 * 60 * 60); // Expires in 1 hour
  const data = `session_${exp}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const hashHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${data}.${hashHex}`;
}

// Helper: Verify the session token
async function verifySessionToken(token, secret) {
  if (!token) return false;
  try {
    const [data, hashHex] = token.split('.');
    const exp = parseInt(data.split('_')[1]);
    if (Date.now() > exp) return false; // Token expired

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    const expectedHashHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex === expectedHashHex;
  } catch (e) {
    return false; // Malformed token
  }
}

export async function onRequestPost(context) {
  try {
    const { env, request } = context;
    const { messages, model, turnstileToken, sessionToken } = await request.json();

    let isAuthorized = false;

    // 1. Try Session Token First (The "Hand Stamp")
    if (await verifySessionToken(sessionToken, env.TURNSTILE_SECRET_KEY)) {
      isAuthorized = true;
    } 
    // 2. If no valid session, check Turnstile Token (The "ID Check")
    else if (turnstileToken) {
      const formData = new FormData();
      formData.append('secret', env.TURNSTILE_SECRET_KEY);
      formData.append('response', turnstileToken);
      formData.append('remoteip', request.headers.get('CF-Connecting-IP'));

      const verifyResult = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData
      });
      const verifyData = await verifyResult.json();
      
      if (verifyData.success) isAuthorized = true;
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Verification failed. Unauthorized access." }), { status: 403 });
    }

    // 3. Call Gemini API
    const apiKey = env.GEMINI_API_KEY;
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(googleUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }))
      })
    });

    const data = await response.json();
    
    // 4. Generate a new valid session token to send back to the user
    const newSessionToken = await createSessionToken(env.TURNSTILE_SECRET_KEY);
    
    return new Response(JSON.stringify({ ...data, sessionToken: newSessionToken }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}