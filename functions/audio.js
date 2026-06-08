// Generates a secure session token
async function createSessionToken(secret) {
  const data = `session_${Date.now()}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const hashHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${data}.${hashHex}`;
}

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

  // Create a Cloudflare WebSocket Pair
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();

  // Establish connection to Google's Multimodal Live API endpoint
  const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${env.GEMINI_API_KEY}`;
  const geminiWs = new WebSocket(geminiWsUrl);

  // Set up the bidirectional stream proxy
  geminiWs.onopen = () => {
    // Send the mandatory initial setup frame once connected to Google
    const setupFrame = {
      setup: {
        model: "models/gemini-2.5-flash-native-audio",
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Kore" // Options: Puck, Charon, Kore, Fenrir, Aoede
              }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: "You are AstralyxAI, the interactive voice core for the AstralyxPvP Minecraft server. Respond conversationally, concisely, and naturally. You are speaking directly through a real-time voice call." }]
        }
      }
    };
    geminiWs.send(JSON.stringify(setupFrame));
  };

  // Pipeline client audio chunks and events to Gemini
  server.addEventListener("message", (event) => {
    if (geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(event.data);
    }
  });

  // Pipeline Gemini audio feedback back to the browser
  geminiWs.addEventListener("message", (event) => {
    if (server.readyState === WebSocket.OPEN) {
      server.send(event.data);
    }
  });

  // Handle stream terminations cleanly
  const closeAll = () => {
    try { server.close(); } catch(_) {}
    try { geminiWs.close(); } catch(_) {}
  };

  server.addEventListener("close", closeAll);
  server.addEventListener("error", closeAll);
  geminiWs.addEventListener("close", closeAll);
  geminiWs.addEventListener("error", closeAll);

  // Generate the next session token to pass back via a header
  const nextSessionToken = await createSessionToken(env.TURNSTILE_SECRET_KEY);

  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: { "X-Next-Session-Token": nextSessionToken }
  });
}
