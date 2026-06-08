// Generates a secure "VIP pass" using HMAC-SHA256
async function createSessionToken(secret) {
  const data = `session_${Date.now()}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const hashHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${data}.${hashHex}`;
}

// Securely verifies the HMAC signature of an incoming session token
async function verifySessionToken(token, secret) {
  if (!token || !token.startsWith('session_') || !token.includes('.')) {
    return false;
  }

  const [data, providedSignature] = token.split('.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expectedSignatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const expectedSignature = Array.from(new Uint8Array(expectedSignatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Prevent timing attacks using a simple time-constant comparison loop if desired, 
  // but a direct comparison here is significantly safer than your original prefix check.
  return providedSignature === expectedSignature;
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();
  const { messages, model, turnstileToken, sessionToken, transcribeAudio, mimeType } = body;
 
  let isAuthorized = false;
 
  // 1. Secure Authorization Check
  if (sessionToken) {
    // Verifies that the token actually originated from your server and wasn't spoofed
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
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
  }

  // Pre-generate a new token for the current response cycle
  const nextSessionToken = await createSessionToken(env.TURNSTILE_SECRET_KEY);

  // 2. Audio Transcription Handler
  if (transcribeAudio && mimeType) {
    const geminiModel = model || "gemini-3.1-flash-lite";
    const cleanMimeType = mimeType.split(';')[0];
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inlineData: {
                  mimeType: cleanMimeType,
                  data: transcribeAudio
                }
              },
              {
                text: "Transcribe the spoken words in this audio precisely. Return ONLY the transcribed text. Do not add any explanations, introductory text, formatting, or commentary."
              }
                ]
          }]
        })
      });
      
      const data = await response.json();
      const transcriptionText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      
      return new Response(JSON.stringify({ transcription: transcriptionText, sessionToken: nextSessionToken }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Transcription failed: " + e.message }), { status: 500 });
    }
  }

  // 3. Regular Chat Handler
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })) })
    });

    const data = await response.json();

    return new Response(JSON.stringify({ ...data, sessionToken: nextSessionToken }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "API call failed: " + e.message }), { status: 500 });
  }
}
