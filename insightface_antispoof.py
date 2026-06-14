import cv2
import numpy as np

class InsightFaceAntiSpoof:
    def __init__(self):
        pass

    def analyze_face(self, image, bbox, kps):
        """
        Menganalisa gambar menggunakan InsightFace bounding box dan keypoints (5 titik) 
        untuk mendeteksi tanda-tanda spoofing.
        Mengembalikan dictionary dengan hasil analisis.
        """
        h, w, c = image.shape
        
        if kps is None or len(kps) != 5:
            return {"success": False, "error": "Keypoints tidak valid", "is_spoof": False}
            
        # kps format: [left_eye, right_eye, nose, left_mouth, right_mouth]
        left_eye = kps[0]
        right_eye = kps[1]
        nose = kps[2]
        
        # 1. Analisis Kedalaman / Muka Datar (Geometry Ratio)
        dist_left_eye_nose = np.linalg.norm(left_eye - nose)
        dist_right_eye_nose = np.linalg.norm(right_eye - nose)
        dist_eyes = np.linalg.norm(left_eye - right_eye)
        
        depth_ratio = 1.0
        if dist_eyes > 0:
            depth_ratio = (dist_left_eye_nose + dist_right_eye_nose) / dist_eyes

        # 2. Analisis Tekstur (Laplacian Variance)
        x1, y1, x2, y2 = map(int, bbox)
        
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(w, x2)
        y2 = min(h, y2)
        
        bw = x2 - x1
        bh = y2 - y1
        
        if bw <= 0 or bh <= 0:
             return {"success": False, "error": "Bounding box tidak valid", "is_spoof": False}

        # Potong 25% dari tepi (kiri, kanan, atas) dan 15% dari bawah 
        # untuk menghilangkan background & dagu/baju
        inner_x1 = int(x1 + bw * 0.25)
        inner_y1 = int(y1 + bh * 0.25)
        inner_x2 = int(x2 - bw * 0.25)
        inner_y2 = int(y2 - bh * 0.15)
        
        inner_x1 = max(0, inner_x1)
        inner_y1 = max(0, inner_y1)
        inner_x2 = min(w, inner_x2)
        inner_y2 = min(h, inner_y2)
        
        inner_w = inner_x2 - inner_x1
        inner_h = inner_y2 - inner_y1

        texture_variance = 0.0
        is_spoof = False
        reasons = []

        if inner_w > 10 and inner_h > 10:
            skin_crop = image[inner_y1:inner_y2, inner_x1:inner_x2]
            gray = cv2.cvtColor(skin_crop, cv2.COLOR_BGR2GRAY)
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            texture_variance = np.var(laplacian)
            
            # Simpan crop kulit untuk debugging (optional)
            cv2.imwrite("debug_skin_crop.jpg", skin_crop)

        # Logika Deteksi Spoofing Berdasarkan Parameter
        # Threshold blur/texture. HP yang dihadapkan ke kamera jarak dekat 
        # kehilangan fokus dan tidak memiliki pori-pori/tekstur.
        if texture_variance > 0 and texture_variance < 35:
            is_spoof = True
            reasons.append(f"Tekstur sangat blur (Variance: {texture_variance:.1f} < 35). Indikasi kamera menempel ke layar/foto.")
            
        return {
            "success": True,
            "depth_ratio": float(depth_ratio),
            "texture_variance": float(texture_variance),
            "is_spoof": is_spoof,
            "reasons": reasons
        }

if_antispoof = InsightFaceAntiSpoof()
