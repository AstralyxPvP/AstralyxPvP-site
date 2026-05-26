export async function onRequestPost(context) {
  try {
    // 1. Pull the secret API key securely from your Cloudflare Dashboard
    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key is not configured on the server." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Read the chat history sent from your HTML website
    const { messages, model } = await context.request.json();

    // 3. Forward the request safely to Google's servers
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
    
    // 4. Send Google's reply back to your HTML website
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