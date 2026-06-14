import cv2
import numpy as np
import mediapipe as mp

def test_mediapipe(image_path):
    mp_face_mesh = mp.solutions.face_mesh
    
    # Inisialisasi model
    with mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5
    ) as face_mesh:
    
        image = cv2.imread(image_path)
        if image is None:
            print("Gagal membaca gambar")
            return
            
        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(img_rgb)
        
        if not results.multi_face_landmarks:
            print("Wajah tidak terdeteksi oleh MediaPipe")
            return
            
        print("Wajah terdeteksi!")
        for face_landmarks in results.multi_face_landmarks:
            h, w, c = image.shape
            
            # Ekstrak depth: Ujung hidung vs Pip
            nose_z = face_landmarks.landmark[1].z
            left_cheek_z = face_landmarks.landmark[234].z
            right_cheek_z = face_landmarks.landmark[454].z
            depth_ratio = abs((left_cheek_z + right_cheek_z) / 2.0 - nose_z)
            print(f"Z-Depth Ratio (Hidung ke Pipi): {depth_ratio:.6f}")
            
            # Buat Convex Hull
            points = []
            for lm in face_landmarks.landmark:
                x, y = int(lm.x * w), int(lm.y * h)
                points.append((x, y))
            points = np.array(points, np.int32)
            
            hull = cv2.convexHull(points)
            mask = np.zeros((h, w), dtype=np.uint8)
            cv2.fillConvexPoly(mask, hull, 255)
            
            # Ambil Bounding Box dari kulit wajah
            x, y, bw, bh = cv2.boundingRect(hull)
            skin_crop = image[y:y+bh, x:x+bw]
            mask_crop = mask[y:y+bh, x:x+bw]
            
            # Hitung Laplacian Variance HANYA pada kulit (tanpa background)
            gray = cv2.cvtColor(skin_crop, cv2.COLOR_BGR2GRAY)
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            
            # Ambil piksel laplacian yang berada di dalam mask (kulit)
            lap_skin = laplacian[mask_crop == 255]
            
            if len(lap_skin) > 0:
                variance = np.var(lap_skin)
                print(f"Skin Texture Variance (Laplacian): {variance:.2f}")
            else:
                print("Mask kulit kosong?")

if __name__ == '__main__':
    print("Test Asli:")
    test_mediapipe("images/sample/image_F1.jpg")
