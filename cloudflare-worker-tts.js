export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "POST") {
      try {
        const { text } = await request.json();
        if (!text) return new Response("Text required", { status: 400, headers: corsHeaders });

        // Menggunakan model TTS dari Cloudflare Workers AI
        const response = await env.AI.run("@cf/microsoft/speecht5-tts", {
          text: text,
        });

        return new Response(response, {
          headers: { ...corsHeaders, "content-type": "audio/wav" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
      }
    }
    return new Response("Kirim POST JSON {text: '...'}", { headers: corsHeaders });
  },
};