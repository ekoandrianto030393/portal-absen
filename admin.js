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
const cameraSelect = document.getElementById('cameraSelect');

// --- 2. KONFIGURASI ---
const MODEL_URL = './models';
const FACE_THRESHOLD = 0.55; // Ambang batas kepercayaan untuk mengunci wajah
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

// --- 6. LOOP DETEKSI WAJAH ---
video.addEventListener('play', () => {
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    async function detectFrame() {
        // Jangan proses jika sedang submit data
        if (isProcessing) return requestAnimationFrame(detectFrame);
        if (video.paused || video.ended) return;

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
        
        // Pastikan loop terus berjalan
        if (detectionInterval) {
            requestAnimationFrame(detectFrame);
        }
    }

    detectionInterval = setInterval(detectFrame, 100);
});

// --- 7. SUBMIT ACTION ---
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

// --- 8. MULAI APLIKASI ---
init();