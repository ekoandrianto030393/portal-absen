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
from models.anti_spoofing.anti_spoof_predict import AntiSpoofPredict
from insightface_antispoof import if_antispoof

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

# --- INISIALISASI MODEL ---
face_app = None
anti_spoof_model = None
MODEL_LOADED = False
ANTISPOOF_ENABLED = False

# --- KONFIGURASI ANTI-SPOOFING ---
# Threshold: Jika skor "ASLI" di bawah angka ini, wajah dianggap PALSU.
# Semakin rendah angkanya, semakin longgar (jarang menolak wajah asli).
# Semakin tinggi angkanya, semakin ketat (tapi bisa menolak wajah asli).
# Rekomendasi: 0.3 - 0.5. Default: 0.4
ANTISPOOF_THRESHOLD = float(os.getenv('ANTISPOOF_THRESHOLD', '0.4'))

# Mode Kalibrasi: Jika True, anti-spoofing hanya MENCETAK log tanpa MENOLAK.
# Set False jika sudah yakin threshold-nya pas dan siap memblokir spoofing.
ANTISPOOF_REJECT_ENABLED = os.getenv('ANTISPOOF_REJECT_ENABLED', 'false').lower() == 'true'

# Threshold Kemiripan Wajah (Face Match InsightFace)
# Jika foto wajah cocok dengan database, skor harus di atas angka ini.
# Rekomendasi: 0.35 - 0.45. Default: 0.40
FACE_MATCH_THRESHOLD = float(os.getenv('FACE_MATCH_THRESHOLD', '0.40'))

# Batas Ukuran Wajah (Deteksi Jarak Jauh/Layar HP Kecil)
# Jika foto wajah di dalam layar HP terlalu kecil, kita langsung tolak!
MIN_FACE_WIDTH = int(os.getenv('MIN_FACE_WIDTH', '130'))
MIN_FACE_HEIGHT = int(os.getenv('MIN_FACE_HEIGHT', '150'))

def init_model():
    """Inisialisasi model InsightFace dan Anti-Spoofing"""
    global face_app, anti_spoof_model, MODEL_LOADED, ANTISPOOF_ENABLED
    try:
        from insightface.app import FaceAnalysis
        print("🔄 Memuat model InsightFace (buffalo_l)... Mohon tunggu...")
        face_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        face_app.prepare(ctx_id=0, det_size=(640, 640))
        MODEL_LOADED = True
        print("✅ Model InsightFace berhasil dimuat!")

        # Inisialisasi Anti-Spoofing
        print("🔄 Memeriksa model Anti-Spoofing...")
        anti_spoof_model = AntiSpoofPredict(0)
        model_path = "models/anti_spoofing/2.7_80x80_MiniFASNetV2.pth"
        if os.path.exists(model_path):
            ANTISPOOF_ENABLED = True
            print("✅ Model Anti-Spoofing AKTIF!")
            print(f"   📊 Threshold Skor ASLI  : {ANTISPOOF_THRESHOLD}")
            print(f"   🛡️ Mode Blokir Otomatis : {'AKTIF ✅' if ANTISPOOF_REJECT_ENABLED else 'NONAKTIF (Mode Kalibrasi)'}")
            if not ANTISPOOF_REJECT_ENABLED:
                print(f"   💡 Untuk mengaktifkan blokir, tambahkan ANTISPOOF_REJECT_ENABLED=true di file .env")
        else:
            print("⚠️ Model Anti-Spoofing TIDAK DITEMUKAN (weights missing).")
            print(f"   Harap letakkan file weights di: {model_path}")
            ANTISPOOF_ENABLED = False

    except ImportError:
        print("❌ ERROR: Library 'insightface' belum terinstal!")
        print("   Jalankan: pip install insightface onnxruntime")
        MODEL_LOADED = False
    except Exception as e:
        print(f"❌ ERROR memuat model: {str(e)}")
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
            
        print(f"👥 INFO: Terdeteksi {len(camera_faces)} wajah di kamera!", flush=True)
        for i, f in enumerate(camera_faces):
            box = f.bbox.astype(int)
            w, h = box[2] - box[0], box[3] - box[1]
            print(f"   Wajah {i+1}: Lebar={w}, Tinggi={h}", flush=True)

        # Urutkan berdasarkan ukuran wajah terbesar
        camera_faces = sorted(camera_faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)
        face = camera_faces[0]
        bbox = face.bbox.astype(int)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]

        # --- STEP 1.1: Cek Batas Jarak (Ukuran Wajah) ---
        if w < MIN_FACE_WIDTH or h < MIN_FACE_HEIGHT:
            print(f"🚫 SPOOFING DITOLAK! Wajah terlalu kecil/jauh (Ukuran: {w}x{h} pixel, Batas: {MIN_FACE_WIDTH}x{MIN_FACE_HEIGHT})", flush=True)
            if ANTISPOOF_REJECT_ENABLED:
                return jsonify({
                    "verified": False,
                    "message": f"Wajah terlalu jauh/kecil. Silakan mendekat ke kamera. (Ukuran Wajah: {w}x{h})",
                    "score": 0.0,
                    "engine": "insightface"
                })

        # --- STEP 1.5: Anti-Spoofing Check (Deteksi HP/Foto) ---
        if ANTISPOOF_ENABLED:
            print(f"🔍 Memulai proses Anti-Spoofing untuk wajah yang terdeteksi...", flush=True)
            
            # --- InsightFace Texture & Geometry Check ---
            insight_check = if_antispoof.analyze_face(camera_img, face.bbox, face.kps)
            print(f"   [Texture/Geometry] Texture Blur Variance: {insight_check['texture_variance']:.2f} | Depth Ratio: {insight_check['depth_ratio']:.4f}", flush=True)
            if insight_check["is_spoof"]:
                print(f"   🚫 SPOOF DETECTED (InsightFace): {insight_check['reasons'][0]}", flush=True)
                if ANTISPOOF_REJECT_ENABLED:
                    return jsonify({
                        "verified": False,
                        "score": 0,
                        "message": f"⚠️ TERDETEKSI FOTO/LAYAR (Terlalu Blur). Gunakan wajah asli. (Var: {insight_check['texture_variance']:.1f})",
                        "engine": "anti_spoofing",
                        "antispoof_detail": {
                            "reasons": insight_check["reasons"],
                            "variance": insight_check["texture_variance"]
                        }
                    }), 403

            # --- MiniFASNet Check ---
            bbox = face.bbox.astype(int)
            # Pastikan bbox valid
            # Logic Crop Persegi Sempurna untuk Anti-Spoofing
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            side = max(w, h) # Gunakan sisi terpanjang agar tetap square
            
            center_x = bbox[0] + w/2
            center_y = bbox[1] + h/2
            
            models = [
                {"path": "models/anti_spoofing/2.7_80x80_MiniFASNetV2.pth", "scale": 2.7}
            ]
            
            prediction = np.zeros((1, 3))
            
            for m in models:
                scale = m["scale"]
                model_path = m["path"]
                
                src_h, src_w = camera_img.shape[:2]
                x, y = bbox[0], bbox[1]
                box_w, box_h = w, h
                
                # Clamp scale (Logika Original MiniFASNet)
                scale = min((src_h-1)/box_h, min((src_w-1)/box_w, scale))
                
                new_width = box_w * scale
                new_height = box_h * scale
                center_x, center_y = box_w/2+x, box_h/2+y
                
                left_top_x = center_x-new_width/2
                left_top_y = center_y-new_height/2
                right_bottom_x = center_x+new_width/2
                right_bottom_y = center_y+new_height/2
                
                if left_top_x < 0:
                    right_bottom_x -= left_top_x
                    left_top_x = 0
                if left_top_y < 0:
                    right_bottom_y -= left_top_y
                    left_top_y = 0
                if right_bottom_x > src_w-1:
                    left_top_x -= right_bottom_x-src_w+1
                    right_bottom_x = src_w-1
                if right_bottom_y > src_h-1:
                    left_top_y -= right_bottom_y-src_h+1
                    right_bottom_y = src_h-1
                    
                face_img = camera_img[int(left_top_y): int(right_bottom_y+1), int(left_top_x): int(right_bottom_x+1)]
                
                if face_img.size > 0:
                    if scale == 2.7:
                        cv2.imwrite("debug_antispoof_27.jpg", face_img)
                    else:
                        cv2.imwrite("debug_antispoof_40.jpg", face_img)
                    
                    pred = anti_spoof_model.predict(face_img, model_path)
                    prediction += pred
            
            # Rata-rata dari 2 model
            prediction /= len(models)
                
            # Output model setelah softmax: 3 probabilitas
            # Index 0 = Probabilitas PALSU (foto/layar)
            # Index 1 = Probabilitas ASLI (wajah nyata)
            # Index 2 = Probabilitas TIDAK PASTI
            prob_fake_1 = prediction[0][0]
            prob_real = prediction[0][1]
            prob_fake_2 = prediction[0][2]
            
            # Total skor PALSU adalah gabungan dari Class 0 dan Class 2
            total_fake = prob_fake_1 + prob_fake_2
            
            print(f"🔍 Anti-Spoof: ASLI={prob_real:.4f} | PALSU_Total={total_fake:.4f} (Batas: {ANTISPOOF_THRESHOLD})", flush=True)
            
            # Tolak jika skor ASLI di bawah threshold DAN mode reject sudah diaktifkan
            if prob_real < ANTISPOOF_THRESHOLD:
                if ANTISPOOF_REJECT_ENABLED:
                    print(f"🚫 SPOOFING DITOLAK! Skor ASLI={prob_real:.4f} < Batas {ANTISPOOF_THRESHOLD}", flush=True)
                    return jsonify({
                        "verified": False,
                        "score": 0,
                        "message": f"⚠️ TERDETEKSI SPOOFING! Gunakan wajah asli. (Skor: {prob_real:.2f})",
                        "engine": "anti_spoofing",
                        "antispoof_detail": {
                            "real": float(prob_real),
                            "fake": float(prob_fake_1),
                            "uncertain": float(prob_fake_2),
                            "threshold": ANTISPOOF_THRESHOLD
                        }
                    }), 403
                else:
                    print(f"⚠️ MODE KALIBRASI: Spoofing terdeteksi tapi TIDAK ditolak (ANTISPOOF_REJECT_ENABLED=false)", flush=True)

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

        # --- SEMENTARA: InsightFace Face Matching Dinonaktifkan ---
        # is_verified = similarity_score > FACE_MATCH_THRESHOLD
        is_verified = True  # BYPASS: Selalu lolos jika sudah lolos Anti-Spoofing
        similarity_score = 1.0 # Fake max score

        # Status warna untuk frontend
        confidence_level = "TINGGI (BYPASS MATCHER)"

        print(f"✅ Verifikasi [{karyawan_id}] {db_result['nama']}: "
              f"BYPASS InsightFace Matcher (Fokus Anti-Spoofing)")

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
# ENDPOINT: KALIBRASI ANTI-SPOOFING
# =============================================================================
@app.route('/antispoof-test', methods=['POST'])
def antispoof_test():
    """Endpoint khusus untuk menguji Anti-Spoofing.
    Kirim foto wajah asli dan foto dari layar HP untuk melihat perbedaan skor.
    Tidak akan menolak apapun, hanya menampilkan hasil analisis."""
    if not ANTISPOOF_ENABLED or not MODEL_LOADED:
        return jsonify({"error": "Anti-Spoofing atau InsightFace belum aktif"}), 503
    
    try:
        data = request.get_json()
        image_base64 = data.get('image', '')
        
        if not image_base64:
            return jsonify({"error": "Parameter 'image' (base64) wajib diisi"}), 400
        
        camera_img = decode_base64_image(image_base64)
        if camera_img is None:
            return jsonify({"error": "Gagal decode gambar"}), 400
        
        # Deteksi wajah
        camera_faces = face_app.get(camera_img)
        if not camera_faces:
            return jsonify({"error": "Tidak ada wajah terdeteksi dalam gambar"}), 400
        
        face = camera_faces[0]
        bbox = face.bbox.astype(int)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        side = max(w, h)
        models = [
            {"path": "models/anti_spoofing/2.7_80x80_MiniFASNetV2.pth", "scale": 2.7}
        ]
        
        # --- InsightFace Texture & Geometry Check ---
        insight_check = if_antispoof.analyze_face(camera_img, face.bbox, face.kps)
        
        prediction = np.zeros((1, 3))
        
        for m in models:
            scale = m["scale"]
            model_path = m["path"]
            
            src_h, src_w = camera_img.shape[:2]
            x, y = bbox[0], bbox[1]
            box_w, box_h = w, h
            
            scale = min((src_h-1)/box_h, min((src_w-1)/box_w, scale))
            
            new_width = box_w * scale
            new_height = box_h * scale
            center_x, center_y = box_w/2+x, box_h/2+y
            
            left_top_x = center_x-new_width/2
            left_top_y = center_y-new_height/2
            right_bottom_x = center_x+new_width/2
            right_bottom_y = center_y+new_height/2
            
            if left_top_x < 0:
                right_bottom_x -= left_top_x
                left_top_x = 0
            if left_top_y < 0:
                right_bottom_y -= left_top_y
                left_top_y = 0
            if right_bottom_x > src_w-1:
                left_top_x -= right_bottom_x-src_w+1
                right_bottom_x = src_w-1
            if right_bottom_y > src_h-1:
                left_top_y -= right_bottom_y-src_h+1
                right_bottom_y = src_h-1
                
            face_img = camera_img[int(left_top_y): int(right_bottom_y+1), int(left_top_x): int(right_bottom_x+1)]
            
            if face_img.size > 0:
                pred = anti_spoof_model.predict(face_img, model_path)
                prediction += pred
                
        prediction /= len(models)
        
        fake_score = float(prediction[0][0])
        real_score = float(prediction[0][1])
        uncertain_score = float(prediction[0][2])
        
        is_real = real_score >= ANTISPOOF_THRESHOLD
        
        # Jika insightface bilang spoof, maka ubah jadi fake
        if insight_check["is_spoof"]:
            is_real = False
            
        label = "ASLI (Wajah Nyata)" if is_real else "PALSU (Foto/Layar)"
        
        print(f"🧪 KALIBRASI Anti-Spoof: {label} | ASLI={real_score:.4f} PALSU={fake_score:.4f} RAGU={uncertain_score:.4f}")
        print(f"   [Texture/Geometry] Var: {insight_check['texture_variance']:.2f} | Depth: {insight_check['depth_ratio']:.4f}")
        
        return jsonify({
            "result": label,
            "is_real": bool(is_real),
            "scores": {
                "real": round(real_score, 4),
                "fake": round(fake_score, 4),
                "uncertain": round(uncertain_score, 4)
            },
            "insightface_metrics": {
                "texture_variance": round(insight_check['texture_variance'], 2),
                "depth_ratio": round(insight_check['depth_ratio'], 4),
                "is_spoof": insight_check['is_spoof'],
                "reasons": insight_check['reasons']
            },
            "threshold": ANTISPOOF_THRESHOLD,
            "recommendation": "Perhatikan 'texture_variance'. Foto dari layar HP biasanya memiliki variance < 35."
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
    print(f"   Health Check : http://localhost:5000/health")
    print(f"   Verification : POST http://localhost:5000/verify")
    print(f"   Kalibrasi    : POST http://localhost:5000/antispoof-test")
    print("=" * 60)

    # Gunakan Waitress sebagai server produksi yang lebih stabil daripada app.run()
    try:
        from waitress import serve
        serve(app, host='0.0.0.0', port=5000)
    except ImportError:
        print("⚠️ Waitress tidak ditemukan. Jalankan: pip install waitress")
        # Fallback ke flask dev server jika waitress tidak ada
        app.run(host='0.0.0.0', port=5000, debug=False)