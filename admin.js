// admin.js - Aether Control - Biometric Registration Logic

// --- 1. DEFINISI ELEMEN DOM ---
const video = document.getElementById('videoElement');
const canvas = document.getElementById('overlay');
const snapCanvas = document.getElementById('snapshotCanvas');
const thresholdFill = document.getElementById('thresholdFill');
const thresholdStatus = document.getElementById('thresholdStatus');
const faceStatus = document.getElementById('faceStatus');
const submitRegisterBtn = document.getElementById('submitRegisterBtn');
const regIdKaryawan = document.getElementById('regIdKaryawan');
const regNama = document.getElementById('regNama');
const regJabatan = document.getElementById('regJabatan');
const btnText = document.getElementById('btnText');
const logStream = document.getElementById('logStream');

// --- 2. KONFIGURASI ---
const MODEL_URL = './models';
const FACE_THRESHOLD = 0.55; // Ambang batas kepercayaan untuk mengunci wajah
let faceDescriptor = null;
let isProcessing = false; // Flag untuk mencegah deteksi/submit ganda

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

// --- 3. INISIALISASI ---
async function init() {
    try {
        addToLogStream('LOADING NEURAL MODELS...', 'text-yellow-500');
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, frameRate: { ideal: 30 } } 
        });
        video.srcObject = stream;
        addToLogStream('SYSTEM ONLINE', 'text-green-400');
    } catch (err) {
        addToLogStream('HARDWARE ERROR: ' + err.message, 'text-red-500');
    }
}

// --- 4. LOOP DETEKSI WAJAH ---
video.addEventListener('play', () => {
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    async function detectFrame() {
        // Jangan proses jika sedang submit data
        if (isProcessing) return requestAnimationFrame(detectFrame);

        const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({
            inputSize: 160, // Optimal untuk kecepatan
            scoreThreshold: 0.5
        })).withFaceLandmarks().withFaceDescriptor();

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detections) {
            const resized = faceapi.resizeResults(detections, displaySize);

            // Gambar kotak deteksi (Box Custom)
            ctx.strokeStyle = '#00eaff';
            ctx.lineWidth = 2;
            ctx.strokeRect(resized.detection.box.x, resized.detection.box.y, resized.detection.box.width, resized.detection.box.height);

            const score = detections.detection.score;
            const percent = Math.round(score * 100);
            thresholdFill.style.width = percent + '%';
            thresholdStatus.textContent = percent + '%';

            if (score > FACE_THRESHOLD) {
                faceStatus.textContent = 'FACE LOCKED';
                faceStatus.className = 'text-lg text-center mt-4 text-green-400 font-bold uppercase';
                submitRegisterBtn.disabled = false;
                btnText.textContent = 'REGISTER SUBJECT';
                faceDescriptor = detections.descriptor;
            } else {
                faceStatus.textContent = 'LOW SIGNAL';
                faceStatus.className = 'text-lg text-center mt-4 text-yellow-500 font-bold uppercase';
                submitRegisterBtn.disabled = true;
                btnText.textContent = 'WAITING FOR FACE...';
            }
        } else {
            thresholdFill.style.width = '0%';
            thresholdStatus.textContent = '0%';
            faceStatus.textContent = 'SEARCHING...';
            faceStatus.className = 'text-lg text-center mt-4 text-red-500 font-bold uppercase';
            submitRegisterBtn.disabled = true;
            btnText.textContent = 'WAITING FOR FACE...';
        }

        requestAnimationFrame(renderFrame);
    }
    detectFrame();
});

// --- 5. SUBMIT ACTION ---
submitRegisterBtn.addEventListener('click', async () => {
    const id = regIdKaryawan.value.trim().toUpperCase();
    const nama = regNama.value.trim();
    const jabatan = regJabatan.value.trim() || 'Staff';

    if (!id || !nama || !jabatan || !faceDescriptor) return;

    isProcessing = true;
    submitRegisterBtn.disabled = true;
    btnText.textContent = 'TRANSMITTING...';
    addToLogStream(`TRANSMITTING DATA: ${id}`, 'text-yellow-500');

    // Snapshot Instan
    const sCtx = snapCanvas.getContext('2d');
    sCtx.save();
    sCtx.scale(-1, 1); // Balikkan gambar secara horizontal agar tidak terbalik
    sCtx.drawImage(video, -snapCanvas.width, 0, snapCanvas.width, snapCanvas.height);
    sCtx.restore();
    const fotoBase64 = snapCanvas.toDataURL('image/jpeg', 0.7);

    try {
        const res = await fetch('/api/karyawan/register_face', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_karyawan: id,
                nama: nama,
                jabatan: jabatan,
                descriptor: Array.from(faceDescriptor),
                foto: fotoBase64
            })
        });

        const result = await res.json();
        if (result.success) {
            document.getElementById('overlayRegId').textContent = id;
            const overlay = document.getElementById('regSuccessOverlay');
            overlay.classList.remove('hidden');

            setTimeout(() => {
                overlay.classList.add('hidden');
                regIdKaryawan.value = '';
                regNama.value = '';
                regJabatan.value = '';
                isProcessing = false;
                submitRegisterBtn.disabled = true; // Nonaktifkan lagi setelah berhasil
            }, 2500);
            addToLogStream(`SUCCESS: ${id} SYNCED`, 'text-green-400');
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        addToLogStream(`SYNC FAILED: ${error.message}`, 'text-red-500');
        isProcessing = false;
        submitRegisterBtn.disabled = false;
        btnText.textContent = 'RETRY';
    }
});

// --- 6. MULAI APLIKASI ---
init();