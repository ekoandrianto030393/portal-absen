import os
import subprocess
import tempfile
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Path ke executable Piper dan Model ONNX
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PIPER_EXE = os.path.join(BASE_DIR, 'piper', 'piper.exe')
MODEL_FILE = os.path.join(BASE_DIR, 'id_ID-news_tts-medium.onnx')

@app.route('/tts', methods=['GET', 'POST'])
def tts():
    if request.method == 'POST':
        data = request.json or {}
        text = data.get('text', '')
    else:
        text = request.args.get('text', '')
        
    if not text:
        return jsonify({"error": "No text provided"}), 400

    if not os.path.exists(PIPER_EXE):
        return jsonify({"error": f"Piper executable not found at {PIPER_EXE}"}), 500
        
    if not os.path.exists(MODEL_FILE):
        return jsonify({"error": f"Model file not found at {MODEL_FILE}"}), 500

    try:
        # Create a temporary file for the output wav
        fd, temp_wav_path = tempfile.mkstemp(suffix='.wav')
        os.close(fd)

        # Run Piper TTS
        # Command: piper.exe -m id_ID-news_tts-medium.onnx --output_file out.wav
        process = subprocess.Popen(
            [PIPER_EXE, '-m', MODEL_FILE, '--output_file', temp_wav_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8' # Pastikan menggunakan utf-8
        )
        
        stdout, stderr = process.communicate(input=text)
        
        if process.returncode != 0:
            os.remove(temp_wav_path)
            return jsonify({"error": "Piper TTS failed", "details": stderr}), 500

        # Send the file and let it be downloaded/played
        # We don't delete the temp file here directly because send_file needs it, 
        # OS will clean it up later from temp dir. Or we could read to memory and send.
        
        with open(temp_wav_path, 'rb') as f:
            audio_data = f.read()
            
        os.remove(temp_wav_path)
            
        from flask import Response
        return Response(audio_data, mimetype="audio/wav")

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "engine": "piper", "model": "id_ID-news_tts-medium.onnx"})

if __name__ == '__main__':
    print("=======================================================")
    print("  PYTHON TTS FALLBACK SERVER (PIPER VITS)")
    print("=======================================================")
    print(f"  Model: {MODEL_FILE}")
    print(f"  Piper: {PIPER_EXE}")
    print("  Server berjalan di http://localhost:5002")
    print("=======================================================")
    
    try:
        from waitress import serve
        serve(app, host='0.0.0.0', port=5002)
    except ImportError:
        print("⚠️ Waitress tidak ditemukan. Menjalankan Flask default server...")
        app.run(host='0.0.0.0', port=5002, debug=False)
