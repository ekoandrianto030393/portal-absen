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
        const payload = await request.json();

        // JIKA REQUEST ADALAH UNTUK GENERATE TEKS SAPAAN
        if (payload.action === "greeting") {
          const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: [
              { role: "system", content: "Anda adalah asisten ramah Puskesmas Wana. Berikan sapaan semangat maksimal 10 kata." },
              { role: "user", content: `Sapa ${payload.name} yang baru saja absen ${payload.status}.` }
            ]
          });
          return new Response(JSON.stringify({ success: true, text: result.response }), {
            headers: { ...corsHeaders, "content-type": "application/json" },
          });
        }

        // JIKA REQUEST ADALAH UNTUK SUARA (TTS) DENGAN FALLBACK
        let audioResponse;
        try {
          // Percobaan 1: MeloTTS (Suara Paling Natural)
          audioResponse = await env.AI.run("@cf/myshell-ai/melotts", {
            text: payload.text,
            lang: payload.lang || "en"
          });
        } catch (e) {
          console.error("MeloTTS failed, trying Deepgram Aura...");
          // Percobaan 2: Deepgram Aura
          audioResponse = await env.AI.run("@cf/deepgram/aura-1", {
            text: payload.text
          });
        }

        return new Response(audioResponse, {
          headers: { ...corsHeaders, "content-type": "audio/mpeg" },
        });
      } catch (err) {
        return new Response("Error nih: " + err.message, { status: 500, headers: corsHeaders });
      }
    }
    return new Response("API TTS Absensi Puskesmas Siap!", { headers: corsHeaders });
  },
};