export default {
  async fetch(request, env) {
    // Setup CORS headers agar bisa dipanggil dari browser (Face-API)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Tangani preflight request dari browser
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Kita buat agar dia hanya merespon perintah POST (dari aplikasi absensi kamu)
    if (request.method === "POST") {
      try {
        const { text } = await request.json();

        // Memanggil mesin AI Cloudflare yang sudah kamu bind di wrangler.toml
        const response = await env.AI.run("@cf/microsoft/speecht5-tts", {
          text: text,
        });

        // Mengirim balik file suara ke laptop kamu
        return new Response(response, {
          headers: { ...corsHeaders, "content-type": "audio/wav" },
        });
      } catch (err) {
        return new Response("Error nih: " + err.message, { status: 500, headers: corsHeaders });
      }
    }
    return new Response("API TTS Absensi Puskesmas Siap!", { headers: corsHeaders });
  },
};