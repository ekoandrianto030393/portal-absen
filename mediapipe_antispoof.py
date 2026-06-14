import cv2
import numpy as np
import mediapipe.python.solutions.face_mesh as mp_face_mesh

class MediaPipeAntiSpoof:
    def __init__(self):
        self.face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )

    def analyze_face(self, image):
        """
        Menganalisa gambar menggunakan MediaPipe untuk mendeteksi tanda-tanda spoofing.
        Mengembalikan dictionary dengan skor dan hasil analisis.
        """
        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(img_rgb)
        
        if not results.multi_face_landmarks:
            return {"success": False, "error": "Wajah tidak terdeteksi oleh MediaPipe", "is_spoof": False}
            
        face_landmarks = results.multi_face_landmarks[0]
        h, w, c = image.shape
        
        # 1. Analisis Kedalaman (Z-Ratio)
        # Hidung (1), Pipi Kiri (234), Pipi Kanan (454)
        nose_z = face_landmarks.landmark[1].z
        left_cheek_z = face_landmarks.landmark[234].z
        right_cheek_z = face_landmarks.landmark[454].z
        
        # Rasio kedalaman absolut
        depth_diff = abs((left_cheek_z + right_cheek_z) / 2.0 - nose_z)
        
        # 2. Pembuatan Mask Kulit Murni
        points = []
        for lm in face_landmarks.landmark:
            x, y = int(lm.x * w), int(lm.y * h)
            points.append((x, y))
        points = np.array(points, np.int32)
        
        hull = cv2.convexHull(points)
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillConvexPoly(mask, hull, 255)
        
        # Ekstrak bounding box dari mask kulit
        x, y, bw, bh = cv2.boundingRect(hull)
        
        # Pastikan bounding box valid
        if bw == 0 or bh == 0:
            return {"success": False, "error": "Bounding box tidak valid", "is_spoof": False}
            
        skin_crop = image[y:y+bh, x:x+bw]
        mask_crop = mask[y:y+bh, x:x+bw]
        
        # 3. Analisis Tekstur (Laplacian Variance)
        gray = cv2.cvtColor(skin_crop, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        
        # Hanya hitung variance di area kulit (abaikan background/mata/mulut jika dimask)
        lap_skin = laplacian[mask_crop == 255]
        
        texture_variance = 0
        if len(lap_skin) > 0:
            texture_variance = np.var(lap_skin)
            
        # Logika Deteksi Spoofing Berdasarkan Parameter
        # - Jika terlalu blur (variance < 15) -> Kemungkinan besar layar/kertas dekat kamera (out of focus)
        # - Jika depth_diff terlalu kecil -> Wajah sangat datar
        is_spoof = False
        reasons = []
        
        if texture_variance < 15:
            is_spoof = True
            reasons.append("Tekstur kulit sangat blur (kemungkinan kamera tidak fokus pada kertas/layar HP)")
            
        if depth_diff < 0.02: 
            is_spoof = True
            reasons.append(f"Dimensi 3D terlalu datar (Z-Ratio: {depth_diff:.4f})")
            
        return {
            "success": True,
            "depth_ratio": float(depth_diff),
            "texture_variance": float(texture_variance),
            "is_spoof": is_spoof,
            "reasons": reasons
        }

mp_antispoof = MediaPipeAntiSpoof()
