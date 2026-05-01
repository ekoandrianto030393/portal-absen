"""
=============================================================================
PYTHON FACE VERIFICATION SERVER (InsightFace + MySQL)
=============================================================================
Server ini berfungsi sebagai lapisan verifikasi wajah tambahan menggunakan
model InsightFace (buffalo_l) yang lebih akurat daripada face-api.js.

ALUR KERJA:
1. Browser (scan.js) mengirim gambar wajah + ID karyawan
2. Server ini mengekstrak embedding InsightFace dari gambar tersebut
3. Server mengambil FOTO tersimpan dari database MySQL
4. Server mengekstrak embedding InsightFace dari foto tersimpan
5. Membandingkan kedua embedding (Cosine Similarity)
6. Mengembalikan hasil verifikasi ke browser

CATATAN PENTING:
- face-api.js menggunakan embedding 128-dimensi
- InsightFace menggunakan embedding 512-dimensi
- Keduanya TIDAK kompatibel, maka kita bandingkan FOTO vs FOTO (bukan descriptor)
=============================================================================
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import base64
import cv2
import json
import numpy as np
import mysql.connector
import os
import traceback

# Muat konfigurasi dari file .env (sama seperti Node.js)
load_dotenv()

app = Flask(__name__)
CORS(app)  # Izinkan permintaan dari frontend browser

# --- KONFIGURASI DATABASE (Dari .env, sama seperti server.js) ---
db_config = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASS', ''),
    'database': os.getenv('DB_NAME', 'biometrik_absensi_wajah_db')
}

# --- INISIALISASI MODEL INSIGHTFACE ---
face_app = None
MODEL_LOADED = False

def init_model():
    """Inisialisasi model InsightFace (buffalo_l) saat startup"""
    global face_app, MODEL_LOADED
    try:
        from insightface.app import FaceAnalysis
        print("🔄 Memuat model InsightFace (buffalo_l)... Mohon tunggu...")
        face_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        face_app.prepare(ctx_id=0, det_size=(640, 640))
        MODEL_LOADED = True
        print("✅ Model InsightFace berhasil dimuat!")
    except ImportError:
        print("❌ ERROR: Library 'insightface' belum terinstal!")
        print("   Jalankan: pip install insightface onnxruntime")
        MODEL_LOADED = False
    except Exception as e:
        print(f"❌ ERROR memuat model InsightFace: {str(e)}")
        MODEL_LOADED = False


def compute_sim(feat1, feat2):
    """Menghitung Cosine Similarity antara dua embedding wajah"""
    dot = np.dot(feat1, feat2)
    norm = np.linalg.norm(feat1) * np.linalg.norm(feat2)
    if norm == 0:
        return 0.0
    return float(dot / norm)


def decode_base64_image(base64_str):
    """Decode gambar Base64 menjadi numpy array (OpenCV format)"""
    # Hapus prefix 'data:image/...;base64,' jika ada
    if ',' in base64_str:
        base64_str = base64_str.split(',')[1]
    img_data = base64.b64decode(base64_str)
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img


def decode_blob_image(blob_data):
    """Decode BLOB dari database MySQL menjadi numpy array (OpenCV format)"""
    nparr = np.frombuffer(blob_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img


# =============================================================================
# ENDPOINT: HEALTH CHECK
# =============================================================================
@app.route('/health', methods=['GET'])
def health_check():
    """Cek apakah server Python berjalan dan model sudah dimuat"""
    return jsonify({
        "status": "online",
        "model_loaded": MODEL_LOADED,
        "model_name": "InsightFace buffalo_l" if MODEL_LOADED else "NOT LOADED",
        "database": db_config['host']
    })


# =============================================================================
# ENDPOINT: VERIFIKASI WAJAH
# =============================================================================
@app.route('/verify', methods=['POST'])
def verify_face():
    """
    Verifikasi wajah menggunakan InsightFace.
    
    Input (JSON):
        - id_karyawan: ID karyawan yang diidentifikasi oleh face-api.js
        - image: Base64 encoded gambar dari kamera
    
    Output (JSON):
        - verified: True/False (hasil verifikasi InsightFace)
        - score: Skor kemiripan (0.0 - 1.0)
        - message: Pesan deskriptif
        - engine: 'insightface' (untuk logging di frontend)
    """
    try:
        if not MODEL_LOADED:
            return jsonify({
                "verified": False,
                "score": 0,
                "message": "Model InsightFace belum dimuat. Server perlu di-restart.",
                "engine": "insightface_error"
            }), 503

        data = request.json
        karyawan_id = data.get('id_karyawan')
        image_base64 = data.get('image')

        if not karyawan_id or not image_base64:
            return jsonify({
                "verified": False,
                "score": 0,
                "message": "Data tidak lengkap (id_karyawan dan image diperlukan)",
                "engine": "insightface"
            }), 400

        # --- STEP 1: Ekstraksi embedding dari gambar kamera ---
        camera_img = decode_base64_image(image_base64)
        if camera_img is None:
            return jsonify({
                "verified": False,
                "score": 0,
                "message": "Gagal decode gambar dari kamera",
                "engine": "insightface"
            })

        camera_faces = face_app.get(camera_img)
        if len(camera_faces) == 0:
            return jsonify({
                "verified": False,
                "score": 0,
                "message": "Wajah tidak terdeteksi oleh InsightFace (kamera)",
                "engine": "insightface"
            })

        camera_embedding = camera_faces[0].embedding.astype(np.float32)

        # --- STEP 2: Ambil FOTO tersimpan dari database ---
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT nama, jabatan, foto FROM karyawan WHERE id_karyawan = %s",
            (karyawan_id,)
        )
        db_result = cursor.fetchone()
        cursor.close()
        conn.close()

        if not db_result:
            return jsonify({
                "verified": False,
                "score": 0,
                "message": f"ID '{karyawan_id}' tidak ditemukan di database",
                "engine": "insightface"
            })

        if not db_result['foto']:
            return jsonify({
                "verified": False,
                "score": 0,
                "message": f"Foto untuk '{db_result['nama']}' belum tersimpan di database",
                "engine": "insightface"
            })

        # --- STEP 3: Ekstraksi embedding dari foto database ---
        stored_img = decode_blob_image(db_result['foto'])
        if stored_img is None:
            return jsonify({
                "verified": False,
                "score": 0,
                "message": "Gagal decode foto dari database",
                "engine": "insightface"
            })

        stored_faces = face_app.get(stored_img)
        if len(stored_faces) == 0:
            return jsonify({
                "verified": False,
                "score": 0,
                "message": f"Wajah tidak terdeteksi pada foto tersimpan '{db_result['nama']}'",
                "engine": "insightface"
            })

        stored_embedding = stored_faces[0].embedding.astype(np.float32)

        # --- STEP 4: Bandingkan kedua embedding ---
        similarity_score = compute_sim(camera_embedding, stored_embedding)

        # Threshold untuk InsightFace (biasanya 0.4-0.6 sudah cukup akurat)
        VERIFICATION_THRESHOLD = 0.45
        is_verified = similarity_score > VERIFICATION_THRESHOLD

        # Status warna untuk frontend
        if similarity_score > 0.6:
            confidence_level = "TINGGI"
        elif similarity_score > VERIFICATION_THRESHOLD:
            confidence_level = "CUKUP"
        else:
            confidence_level = "RENDAH"

        print(f"{'✅' if is_verified else '❌'} Verifikasi [{karyawan_id}] {db_result['nama']}: "
              f"Score={similarity_score:.4f} ({confidence_level}) | "
              f"Threshold={VERIFICATION_THRESHOLD}")

        return jsonify({
            "verified": is_verified,
            "score": round(similarity_score, 4),
            "message": f"InsightFace: {'COCOK' if is_verified else 'TIDAK COCOK'} "
                       f"(Score: {similarity_score:.2f}, Level: {confidence_level})",
            "engine": "insightface",
            "nama": db_result['nama'],
            "jabatan": db_result['jabatan'],
            "confidence": confidence_level
        })

    except mysql.connector.Error as db_err:
        print(f"❌ Database Error: {str(db_err)}")
        return jsonify({
            "verified": False,
            "score": 0,
            "message": f"Database Error: {str(db_err)}",
            "engine": "insightface"
        }), 500

    except Exception as e:
        print(f"❌ Server Error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "verified": False,
            "score": 0,
            "message": f"Python Server Error: {str(e)}",
            "engine": "insightface"
        }), 500


# =============================================================================
# START SERVER
# =============================================================================
if __name__ == '__main__':
    print("=" * 60)
    print("  BIOMETRIK - Python Face Verification Server")
    print("  Engine: InsightFace (buffalo_l)")
    print(f"  Database: {db_config['host']} / {db_config['database']}")
    print("=" * 60)

    # Inisialisasi model saat startup
    init_model()

    # Test koneksi database
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM karyawan")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        print(f"✅ Database terkoneksi! Total karyawan: {count}")
    except Exception as e:
        print(f"❌ Gagal koneksi database: {str(e)}")
        print("💡 Pastikan XAMPP MySQL sudah di-Start!")

    print(f"\n🚀 Python Server berjalan di http://localhost:5000")
    print(f"   Health Check: http://localhost:5000/health")
    print(f"   Verification: POST http://localhost:5000/verify")
    print("=" * 60)

    # Jalankan server Flask pada port 5000
    app.run(host='0.0.0.0', port=5000, debug=False)