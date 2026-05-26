export async function onRequestPost(context) {
  try {
    const { env, request } = context;
    const { messages, model, turnstileToken } = await request.json();

    // 1. Verify Turnstile Token (Server-Side)
    const formData = new FormData();
    formData.append('secret', env.TURNSTILE_SECRET_KEY);
    formData.append('response', turnstileToken);
    formData.append('remoteip', request.headers.get('CF-Connecting-IP'));

    const verifyResult = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });
    const verifyData = await verifyResult.json();

    if (!verifyData.success) {
      return new Response(JSON.stringify({ error: "Verification failed. Unauthorized access." }), { 
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Proceed with your AI logic (API Key is safe in env)
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
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}