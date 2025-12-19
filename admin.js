// admin.js - Aether Control - Biometric Registration Logic

// --- 1. DEFINISI ELEMEN DOM ---
const video = document.getElementById('videoElement');
const canvas = document.getElementById('overlay');
const snapCanvas = document.getElementById('snapshotCanvas');
const thresholdFill = document.getElementById('thresholdFill');
const thresholdStatus = document.getElementById('thresholdStatus');
const faceStatus = document.getElementById('faceStatus');
const btnRegister = document.getElementById('btnRegister');
const regIdKaryawan = document.getElementById('regIdKaryawan');
const regNama = document.getElementById('regNama');
const regJabatan = document.getElementById('regJabatan');
const btnText = document.getElementById('btnText');
const logStream = document.getElementById('logStream');
const cameraSelect = document.getElementById('cameraSelect');
const flashEffect = document.getElementById('flashEffect');

// --- 2. KONFIGURASI ---
const MODEL_URL = './models';
const FACE_THRESHOLD = 0.45; // Ambang batas kepercayaan untuk mengunci wajah
let faceDescriptor = null;
let isProcessing = false; // Flag untuk mencegah deteksi/submit ganda
let currentStream = null;
let videoDevices = [];
let detectionInterval = null;

// --- 3. FUNGSI UTILITAS ---
function addToLogStream(msg, color = 'text-cyan-400') {
    const p = document.createElement('p');
    p.className = color;
    p.textContent = `> [${new Date().toLocaleTimeString()}] ${msg}`;
    logStream.prepend(p);
    // Batasi jumlah log agar tidak membebani memori
    if (logStream.children.length > 50) {
        logStream.removeChild(logStream.lastChild);
    }
}

// --- 4. MANAJEMEN KAMERA ---
function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
}

async function getCameraDevices() {
    videoDevices = [];
    cameraSelect.innerHTML = '';

    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        devices.forEach(device => {
            if (device.kind === 'videoinput') {
                videoDevices.push(device);
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${videoDevices.length}`;
                cameraSelect.appendChild(option);
            }
        });

        if (!cameraSelect.dataset.listenerAttached) {
            cameraSelect.addEventListener('change', (e) => startCamera(e.target.value));
            cameraSelect.dataset.listenerAttached = 'true';
        }

    } catch (error) {
        addToLogStream(`Error enumerating devices: ${error.message}`, 'text-red-500');
    }
}

async function startCamera(deviceId = null) {
    stopCamera();
    addToLogStream('Starting camera stream...', 'text-cyan-500');

    const constraints = {
        video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 }
        }
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        video.srcObject = stream;
        addToLogStream('Camera stream active.', 'text-green-400');
    } catch (err) {
        addToLogStream('HARDWARE ERROR: ' + err.message, 'text-red-500');
    }
}

// --- 5. INISIALISASI APLIKASI ---
async function init() {
    try {
        addToLogStream('LOADING NEURAL MODELS...', 'text-yellow-500');
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        addToLogStream('Neural models loaded.', 'text-green-400');

        await getCameraDevices();
        await startCamera(cameraSelect.value);

    } catch (err) {
        addToLogStream('INIT FAILED: ' + err.message, 'text-red-500');
    }
}

function triggerFlash() {
    if (!flashEffect) return;
    flashEffect.style.transition = 'opacity 0.1s ease-out';
    flashEffect.style.opacity = '0.8';
    setTimeout(() => {
        flashEffect.style.opacity = '0';
    }, 150);
}
// --- 7. FUNGSI PENDAFTARAN OTOMATIS ---
async function performRegistration() {
    // Kunci proses agar tidak berjalan ganda
    if (isProcessing) return;
    
    const id = regIdKaryawan.value.trim().toUpperCase();
    const nama = regNama.value.trim();
    const jabatan = regJabatan.value.trim() || 'Staff';

    if (!id || !nama) {
        alert('Mohon lengkapi ID dan Nama Karyawan terlebih dahulu!');
        return;
    }

    isProcessing = true;

    btnText.textContent = 'TRANSMITTING...';
    btnRegister.classList.add('opacity-50', 'cursor-not-allowed'); // Disable visual saat loading
    addToLogStream(`TRANSMITTING DATA: ${id}`, 'text-yellow-500');

    // Picu efek flash
    triggerFlash();

    // Snapshot Instan
    const sCtx = snapCanvas.getContext('2d');
    sCtx.save();
    sCtx.scale(-1, 1); // Balikkan gambar secara horizontal
    sCtx.drawImage(video, -snapCanvas.width, 0, snapCanvas.width, snapCanvas.height);
    sCtx.restore();
    const fotoBase64 = snapCanvas.toDataURL('image/jpeg', 0.7);

    try {
        const res = await fetch('/api/karyawan/register_face', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_karyawan: id, nama, jabatan, descriptor: Array.from(faceDescriptor), foto: fotoBase64 })
        });

        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        document.getElementById('overlayRegId').textContent = id;
        document.getElementById('regSuccessOverlay').classList.remove('hidden');
        addToLogStream(`SUCCESS: ${id} SYNCED`, 'text-green-400');
        setTimeout(resetRegistrationForm, 2500);

    } catch (error) {
        addToLogStream(`SYNC FAILED: ${error.message}`, 'text-red-500');
        isProcessing = false; // Buka kunci jika gagal agar bisa coba lagi
    }
}

// Event Listener: Klik tombol untuk simpan
btnRegister.addEventListener('click', performRegistration);

// --- 6. LOOP DETEKSI WAJAH ---
video.addEventListener('play', () => {
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    async function detectFrame() {
        // Jangan proses jika sedang submit data
        if (isProcessing) return; // Stop loop sementara saat proses
        if (video.paused || video.ended) return;

        // Gunakan detectAllFaces untuk mendeteksi lebih dari satu wajah
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
            inputSize: 160, // Optimal untuk kecepatan
            scoreThreshold: 0.45
        })).withFaceLandmarks().withFaceDescriptors();

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detections.length > 1) {
            // KASUS: Lebih dari 1 wajah terdeteksi
            faceStatus.textContent = 'MULTIPLE TARGETS DETECTED';
            faceStatus.className = 'text-lg text-center mt-4 text-red-500 font-bold uppercase animate-pulse';
            btnText.textContent = 'HANYA SATU WAJAH';
            btnRegister.disabled = true;
            btnRegister.classList.add('opacity-50', 'cursor-not-allowed');

            // Gambar kotak untuk semua wajah yang terdeteksi
            detections.forEach(detection => {
                const resized = faceapi.resizeResults(detection, displaySize);
                ctx.strokeStyle = '#ff4757'; // Merah untuk peringatan
                ctx.lineWidth = 2;
                ctx.strokeRect(resized.detection.box.x, resized.detection.box.y, resized.detection.box.width, resized.detection.box.height);
            });

        } else if (detections.length === 1) {
            // KASUS: Tepat 1 wajah terdeteksi (Normal)
            const singleDetection = detections[0];
            const resized = faceapi.resizeResults(singleDetection, displaySize);
            const score = singleDetection.detection.score;
            const percent = Math.round(score * 100);

            ctx.strokeStyle = '#00eaff'; // Cyan untuk deteksi normal
            ctx.lineWidth = 2;
            ctx.strokeRect(resized.detection.box.x, resized.detection.box.y, resized.detection.box.width, resized.detection.box.height);

            thresholdFill.style.width = percent + '%';
            thresholdStatus.textContent = percent + '%';

            if (score > FACE_THRESHOLD) {
                faceStatus.textContent = 'FACE LOCKED';
                faceStatus.className = 'text-lg text-center mt-4 text-green-400 font-bold uppercase';
                faceDescriptor = singleDetection.descriptor;

                // WAJAH TERKUNCI: Aktifkan Tombol
                btnRegister.disabled = false;
                btnRegister.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-indigo-900');
                btnRegister.classList.add('bg-green-600', 'hover:bg-green-500', 'cursor-pointer');
                btnText.textContent = 'KLIK UNTUK SIMPAN';

            } else {
                faceStatus.textContent = 'LOW SIGNAL';
                faceStatus.className = 'text-lg text-center mt-4 text-yellow-500 font-bold uppercase';
                
                btnRegister.disabled = true;
                btnRegister.classList.add('opacity-50', 'cursor-not-allowed', 'bg-indigo-900');
                btnRegister.classList.remove('bg-green-600', 'hover:bg-green-500', 'cursor-pointer');
                btnText.textContent = 'POSISIKAN WAJAH';
            }
        } else {
            // KASUS: Tidak ada wajah terdeteksi
            faceStatus.textContent = 'SEARCHING...';
            faceStatus.className = 'text-lg text-center mt-4 text-red-500 font-bold uppercase';
            btnText.textContent = 'WAITING FOR FACE...';
            btnRegister.disabled = true;
            btnRegister.classList.add('opacity-50', 'cursor-not-allowed', 'bg-indigo-900');
            btnRegister.classList.remove('bg-green-600', 'hover:bg-green-500', 'cursor-pointer');
        }
        
        // Pastikan loop terus berjalan
        if (detectionInterval) {
            requestAnimationFrame(detectFrame);
        }
    }

    detectionInterval = setInterval(detectFrame, 100);
});

// --- 8. FUNGSI RESET ---
function resetRegistrationForm() {
    document.getElementById('regSuccessOverlay').classList.add('hidden');
    regIdKaryawan.value = '';
    regNama.value = '';
    regJabatan.value = '';
    isProcessing = false; // Buka kunci setelah semua selesai
    btnText.textContent = 'WAITING FOR FACE...';
    btnRegister.disabled = true;
    btnRegister.classList.add('opacity-50', 'cursor-not-allowed', 'bg-indigo-900');
    btnRegister.classList.remove('bg-green-600', 'hover:bg-green-500');
}

// --- 9. MULAI APLIKASI ---
init();