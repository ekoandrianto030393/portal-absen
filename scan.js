/**
 * scan.js - Advanced Biometric Gateway (PUSKESMAS WANA)
 * FINAL STABILIZATION & CUSTOMIZATION: Disesuaikan 100% untuk UI FUTURISTIK Anda.
 * Overlay Sukses telah ditingkatkan (Revisi Akhir).
 */

// --- GLOBAL DOM & VARS (Disesuaikan dengan ID HTML Anda) ---
const video = document.getElementById('videoElement');
const canvas = document.getElementById('overlay');
const videoContainer = document.getElementById('videoContainer');
const statusMessage = document.getElementById('statusMessage');
const successOverlay = document.getElementById('successOverlay');
const userIdDisplay = document.getElementById('userIdDisplay');
const userStatusDisplay = document.getElementById('userStatusDisplay');
const lastActionDisplay = document.getElementById('lastActionDisplay');
const userPhotoDisplay = document.getElementById('userPhotoDisplay'); 
const userJabatanDisplay = document.getElementById('userJabatanDisplay');

// ELEMEN HUD & DIAGNOSTIK (Diambil dari HTML Futuristik Anda)
const systemLog = document.getElementById('systemLog');
const mainTitle = document.getElementById('mainTitle');
const clockH = document.getElementById('clock-h');
const clockM = document.getElementById('clock-m');
const clockS = document.getElementById('clock-s');
const clockMs = document.getElementById('clock-ms');
const clockDate = document.getElementById('clock-date');
const clockBar = document.getElementById('clock-bar');


const cameraSelect = document.getElementById('cameraSelect');
const networkStatus = document.getElementById('networkStatus');
const cameraStatus = document.getElementById('cameraStatus');
const dbStatus = document.getElementById('dbStatus');

const cpuLoadBar = document.getElementById('cpuLoadBar');
const cpuLoadText = document.getElementById('cpuLoad');
const memUsageBar = document.getElementById('memUsageBar');
const memUsageText = document.getElementById('memUsage');
const matchThresholdBar = document.getElementById('matchThresholdBar');
const matchConfidenceText = document.getElementById('matchConfidenceText');
const dataStream = document.getElementById('dataStream');
const graphElement = document.getElementById('graph');

let labeledDescriptors = null;
let detectionInterval = null;
let isProcessing = false; // Kunci: true saat sedang kirim data/cooldown
let lastKnownMatch = null; 
let employeeMap = {}; 
let currentStream = null;
let videoDevices = []; 

const FACE_MATCHING_THRESHOLD = 0.32; // 0.40: Seimbang. Cukup ketat tapi tetap mengenali wajah asli.
const DETECTION_INTERVAL_MS = 100;
const DEFAULT_PHOTO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0idy00IGgtNCI+PHBhdGggZD0iTTggOGE0IDQgMCAxIDAgMC04IDQgNCAwIDAgMCAwIDh6bTAtMWEzIDMgMCAxIDEtNiAwIDMgMyAwIDAgMSA2IDB6TTggOWE1IDUgMCAwIDAtNSA1djJBNiA2IDAgMCAwIDggMjFhNiA2IDAgMCAwIDYtNnYtMmE1IDUgMCAwIDAtNS01ek04IDE5YTUgNSAwIDAgMS00LTJ2LTFhNCA0IDAgMCAxIDQtNGM0IDAgMy44MiA0IDQgNGMtLjE4LjMyLS4zOC42My0uNTggLjkzQTUuMDAzIDUuMDAzIDAgMCAxIDggMTl6Ii8+PC9zdmc+'; // Placeholder photo

// --- DEFINISI WARNA (Futuristik) ---
const PROFESSIONAL_STATUS_COLOR = '#00FF7F'; 
const NAME_HIGHLIGHT_COLOR = '#FFD700'; // Kuning Emas Neon
const HEADER_COLOR = '#00FFFF'; 
const ABSEN_GANDA_BG = 'radial-gradient(circle, rgba(255,165,0,0.8) 0%, rgba(204,133,0,0.95) 100%)'; 
const ABSEN_NORMAL_BG = 'radial-gradient(circle, rgba(0,255,127,0.8) 0%, rgba(0,100,0,0.95) 100%)'; 

// =============================================================================
// 1. MESIN RENDERING VISUAL CANVAS (DRAWING Face-API)
// =============================================================================

function drawTechBracket(ctx, x, y, w, h, color) {
    const lineLen = w / 5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'square';
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    // Kiri Atas
    ctx.beginPath(); ctx.moveTo(x, y + lineLen); ctx.lineTo(x, y); ctx.lineTo(x + lineLen, y); ctx.stroke();
    // Kanan Atas
    ctx.beginPath(); ctx.moveTo(x + w - lineLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + lineLen); ctx.stroke();
    // Kanan Bawah
    ctx.beginPath(); ctx.moveTo(x + w, y + h - lineLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - lineLen, y + h); ctx.stroke();
    // Kiri Bawah
    ctx.beginPath(); ctx.moveTo(x + lineLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - lineLen); ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawMatchLabel(ctx, box, label, color) {
    let fontSize = 24;
    if (box.width < 100) fontSize = 18;
    
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'black';

    const textWidth = ctx.measureText(label).width;
    const padding = 10;
    const bgX = box.x + (box.width / 2) - (textWidth / 2) - padding / 2;
    const bgY = box.y - 40;
    const bgW = textWidth + padding;
    const bgH = 30;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(bgX, bgY, bgW, bgH);

    ctx.fillStyle = color;
    ctx.fillText(label, box.x + box.width / 2, box.y - 18);
    ctx.shadowBlur = 0;
}

function drawHolographicMesh(ctx, landmarks) {
    const points = landmarks.positions;
    
    // Efek Denyut (Pulse) pada Mesh
    const time = Date.now() / 500;
    const alpha = 0.2 + 0.3 * Math.abs(Math.sin(time));

    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha + 0.2})`; // Cyan Pulse
    ctx.fillStyle = `rgba(0, 255, 255, ${alpha * 0.1})`;

    const regions = [
        [0, 16, false], [17, 21, false], [22, 26, false], [27, 30, false],
        [31, 35, false], [36, 41, true], [42, 47, true], [48, 59, true], [60, 67, true]
    ];

    ctx.beginPath();
    regions.forEach(region => {
        const start = region[0];
        const end = region[1];
        const isLoop = region[2];
        ctx.moveTo(points[start].x, points[start].y);
        for (let i = start + 1; i <= end; i++) ctx.lineTo(points[i].x, points[i].y);
        if (isLoop) ctx.lineTo(points[start].x, points[start].y);
    });
    ctx.stroke();
    ctx.fill();
}

// --- FITUR BARU: SCANNING BEAM ---
function drawScanningBeam(ctx, box) {
    const time = Date.now() / 1000;
    const scanHeight = box.height;
    // Gerakan naik turun menggunakan Sinus
    const yPos = box.y + (scanHeight * ((Math.sin(time * 4) + 1) / 2));

    ctx.beginPath();
    ctx.moveTo(box.x, yPos);
    ctx.lineTo(box.x + box.width, yPos);
    ctx.strokeStyle = 'rgba(0, 255, 127, 0.8)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00FF7F';
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// --- FITUR BARU: TARGET LOCK HUD ---
function drawTargetLock(ctx, x, y, radius) {
    const time = Date.now() / 1000;
    ctx.save();
    ctx.translate(x, y);
    
    // Cincin Luar (Berputar)
    ctx.rotate(time * 1.5);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 1.5); // Lingkaran tidak penuh
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Cincin Dalam (Berputar Berlawanan)
    ctx.rotate(time * -3); // Reset rotasi + putar balik
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 8]); // Garis putus-putus
    ctx.stroke();
    
    ctx.restore();
}

function drawDataTags(ctx, box, landmarks) {
    const tagX = box.right + 20;
    let tagY = box.top + 10;
    const fontSize = 12;

    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.textAlign = 'left';

    const nose = landmarks.getNose()[0];
    const jaw = landmarks.getJawOutline()[8];
    const tilt = (nose.x - jaw.x).toFixed(2);

    const dataLines = [
        { text: `SIG: 0x${Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase()}`, color: '#00FFFF' },
        { text: `PROX: ${(2500 / box.width).toFixed(0)}mm`, color: '#00FFFF' },
        { text: `TILT: ${tilt}°`, color: '#00FF7F' },
        { text: `SYNC: ACTIVE`, color: '#FF00FF' }
    ];

    ctx.beginPath(); ctx.strokeStyle = 'rgba(38, 0, 255, 0.5)';
    ctx.moveTo(box.right, box.top); ctx.lineTo(tagX - 10, box.top); ctx.stroke();

    dataLines.forEach((item, i) => {
        ctx.fillStyle = item.color;
        ctx.fillText(item.text, tagX, tagY + (i * 18));
    });
}

// =============================================================================
// 2. FUNGSI UTILITAS & HUD (Diadaptasi untuk HTML baru)
// =============================================================================

function logSystem(message, color = 'text-green-500') {
    if (!systemLog) return;
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const newLog = document.createElement('p');
    newLog.className = `${color} my-0.5 text-xs`;
    newLog.innerHTML = `[${timestamp}] > ${message}`;
    newLog.style.opacity = 0;
    setTimeout(() => newLog.style.opacity = 1, 10);
    systemLog.prepend(newLog);
    while (systemLog.children.length > 10) {
        systemLog.removeChild(systemLog.lastChild);
    }
}

function setStatusVisual(message, colorClass, isPulsing = false) {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    // Hapus glitch-text saat status berubah agar lebih jelas
    statusMessage.classList.remove('glitch-text'); 
    statusMessage.className = 'text-xl lg:text-2xl font-bold transition-colors duration-300';
    // Gunakan kelas warna dari Tailwind yang ada di CSS Anda
    statusMessage.classList.add(colorClass);

    if (isPulsing) {
        statusMessage.classList.add('animate-pulse');
    } else {
        statusMessage.classList.remove('animate-pulse');
    }
}

function resizeCanvas() {
    // Ukuran canvas disamakan dengan ukuran videoContainer.
    const W = videoContainer.clientWidth; 
    // Tinggi aktual harus dihitung karena kontainer menggunakan padding-top 56.25% (16:9)
    const videoH = videoContainer.clientWidth * 0.5625;

    if (W > 0 && videoH > 0) {
        canvas.width = W;
        canvas.height = videoH;

        // Pastikan video dan canvas diatur secara absolut
        video.style.width = `${W}px`;
        video.style.height = `${videoH}px`;
        canvas.style.width = `${W}px`;
        canvas.style.height = `${videoH}px`;

        // PENTING: Untuk Face-API
        faceapi.matchDimensions(canvas, { width: W, height: videoH });
        logSystem(`Canvas resized to ${W}x${videoH}.`, 'text-cyan-500');
    }
}

window.addEventListener('resize', resizeCanvas);


function updateSystemDiagnostics(confidence) {
    // 1. CPU/Memory (Simulasi)
    const newCpu = Math.floor(Math.random() * 5) + 10; // 10% - 14%
    const newMem = Math.floor(Math.random() * 8) + 28; // 28% - 35%
    if(cpuLoadBar) {
        cpuLoadBar.style.width = `${newCpu}%`;
        cpuLoadText.textContent = `${newCpu}%`;
    }
    if(memUsageBar) {
        memUsageBar.style.width = `${newMem}%`;
        memUsageText.textContent = `${newMem}%`;
    }

    // 2. Confidence Bar
    if(matchThresholdBar) {
        const confPercent = Math.min(100, confidence);
        matchThresholdBar.style.width = `${confPercent}%`;
        
        if (confPercent >= 70) {
            matchThresholdBar.className = 'loader-fill';
            matchThresholdBar.style.background = 'linear-gradient(90deg, #00FF7F, #00FFFF)';
        } else if (confPercent >= 40) {
            matchThresholdBar.className = 'loader-fill';
            matchThresholdBar.style.background = 'linear-gradient(90deg, #FFD700, #FF00FF)';
        } else {
            matchThresholdBar.className = 'loader-fill-red';
            matchThresholdBar.style.background = 'linear-gradient(90deg, #FF0055, #FF5500)';
        }
        matchConfidenceText.textContent = `${confPercent.toFixed(0)}%`;
    }
}

function updateDataStream() {
    if(!dataStream) return;
    const chars = '01FfAaBbCcDdEe987654321';
    let result = '';
    for (let i = 0; i < 20; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    const timestamp = new Date().toLocaleTimeString('id-ID', {hour12: false, second: '2-digit'});

    const newStreamEntry = document.createElement('p');
    newStreamEntry.className = 'my-0.5 text-cyan-700';
    newStreamEntry.innerHTML = `${timestamp}: <span class="text-amber-500">${result}</span>`;
    dataStream.prepend(newStreamEntry);

    if (dataStream.children.length > 8) dataStream.removeChild(dataStream.lastChild);
}

function updateGraph() {
    if(!graphElement) return;
    const barHeight = Math.floor(Math.random() * 90) + 5;
    const bar = document.createElement('div');
    bar.className = 'graph-bar';
    bar.style.height = `${barHeight}%`;
    const colors = ['#f0d90eff', '#00FF7F', '#FF00FF'];
    bar.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    bar.style.boxShadow = `0 0 5px ${bar.style.backgroundColor}`;
    graphElement.appendChild(bar);
    if (graphElement.children.length > 30) graphElement.removeChild(graphElement.firstChild);
}

// Panggil update HUD pada interval
function updateClock() {
    const now = new Date();
    if (clockH) clockH.textContent = String(now.getHours()).padStart(2, '0');
    if (clockM) clockM.textContent = String(now.getMinutes()).padStart(2, '0');
    if (clockS) clockS.textContent = String(now.getSeconds()).padStart(2, '0');
    
    // Update Milidetik & Tanggal (Fitur Canggih)
    if (clockMs) clockMs.textContent = String(now.getMilliseconds()).padStart(3, '0');
    
    if (clockDate) {
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} // ${days[now.getDay()]}`;
        clockDate.textContent = dateStr;
    }

    if (clockBar) {
        // Progress bar mengisi penuh setiap 60 detik (1 menit)
        const totalMs = (now.getSeconds() * 1000) + now.getMilliseconds();
        const percent = (totalMs / 60000) * 100;
        clockBar.style.width = `${percent}%`;
    }
}

function animateTitle() {
    if (!mainTitle) return;
    mainTitle.style.opacity = 1;
    const text = "PUSKESMAS WANA";
    mainTitle.innerHTML = ''; // Kosongkan dulu

    const chars = text.split('');
    const totalChars = chars.length;
    const animationCycleDuration = 3; // detik, harus sesuai dengan durasi @keyframes CSS
    const staggerDelayPerChar = animationCycleDuration / totalChars; // Contoh: 3s / 15 chars = 0.2s

    // Pastikan mainTitle memiliki gaya yang diperlukan untuk overflow dan posisi relatif
    mainTitle.style.position = 'relative';
    mainTitle.style.overflow = 'hidden';
    mainTitle.style.minHeight = '1.2em'; // Sesuaikan sesuai ukuran font
    mainTitle.style.whiteSpace = 'nowrap'; // Mencegah teks melipat

    chars.forEach((char, index) => {
        const span = document.createElement('span');
        span.textContent = char === ' ' ? '\u00A0' : char; // Handle spasi
        span.className = 'title-char';
        // Hitung delay bertahap
        const delay = index * staggerDelayPerChar;
        span.style.animationDelay = `${delay}s`;
        if (Math.random() > 0.7) span.classList.add('glitch-text'); // Tambahkan glitch acak ke span
        mainTitle.appendChild(span);
    });
}


setInterval(updateClock, 1000);

const api = {
    getDescriptors: async () => {
        try {
            const response = await fetch('/get-descriptors');
            if (!response.ok) {
                throw new Error(`Server endpoint /get-descriptors not found (Status: ${response.status})`);
            }
            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'API returned failure.');
            return data.descriptors;
        } catch (error) {
            console.error('Error loading descriptors:', error);
            throw error; // Lemparkan error agar bisa ditangkap oleh pemanggil
        }
    },
    postAttendance: async (karyawanId) => {
        const response = await fetch('/absensi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_karyawan: karyawanId })
        });
        if (!response.ok) throw new Error(`Server returned an error status (${response.status}).`);
        return await response.json();
    }
};

async function loadLabeledImages() {
    setStatusVisual('BOOT SEQUENCE: Memuat Database Wajah...', 'text-cyan-500', true);
    if(dbStatus) {
        dbStatus.textContent = 'LOADING...';
        dbStatus.className = 'text-amber-500 font-bold';
    }
    logSystem('Database Sync Initiated.', 'text-cyan-500');
    
    try {
        const descriptorsData = await api.getDescriptors();
        if (descriptorsData.length === 0) throw new Error('Database is empty.');

        const descriptors = descriptorsData.map(item => {
            const descriptorArray = JSON.parse(item.face_descriptor);
            // Simpan semua data yang dibutuhkan, termasuk foto base64
            employeeMap[item.id_karyawan] = {
                nama: item.nama,
                jabatan: item.jabatan || 'N/A',
                foto: item.foto || null
            };
            return new faceapi.LabeledFaceDescriptors(item.id_karyawan, [new Float32Array(descriptorArray)]);
        });

        
        setStatusVisual(`${descriptors.length} ID Karyawan dimuat. SYSTEM READY.`, 'text-green-500');
        if(dbStatus) {
            dbStatus.textContent = 'ONLINE';
            dbStatus.className = 'text-green-500 font-bold';
        }
        logSystem(`Database loaded: ${descriptors.length} records.`, 'text-green-500');
        return descriptors;

    } catch (error) {
        console.error('Error loading descriptors:', error);
        setStatusVisual(`⚠️ DB OFFLINE. Hanya Deteksi Wajah Aktif.`, 'text-red-500');
        if(dbStatus) {
            dbStatus.textContent = 'OFFLINE';
            dbStatus.className = 'text-red-500 font-bold';
        }
        logSystem(`Database load failed: ${error.message}`, 'text-red-500');
        return [];
    }
}

async function getCameraDevices() {
    videoDevices = [];
    if (!cameraSelect) return;
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

        // Tampilkan/sembunyikan select berdasarkan jumlah kamera
        const cameraSelectDiv = cameraSelect.closest('.widget-panel');
        if (videoDevices.length > 1 && cameraSelectDiv) { 
            cameraSelectDiv.style.display = 'flex'; 
        } else if (cameraSelectDiv) {
             cameraSelectDiv.style.display = 'none';
        }

        if (!cameraSelect.dataset.listenerAttached) {
            cameraSelect.addEventListener('change', (e) => switchCamera(e.target.value));
            cameraSelect.dataset.listenerAttached = 'true';
        }

    } catch (error) {
        logSystem(`Error enumerating devices: ${error.message}`, 'text-red-500');
    }
}

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

async function startCamera(deviceId = null) {
    stopCamera(); 
    
    if(cameraStatus) {
        cameraStatus.textContent = 'CONNECTING...';
        cameraStatus.className = 'text-amber-500 font-bold';
    }
    logSystem('Camera stream starting...', 'text-cyan-500');

    try {
        const constraints = {
            video: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        video.srcObject = stream;
        
        if(cameraStatus) {
            cameraStatus.textContent = 'ACTIVE';
            cameraStatus.className = 'text-green-500 font-bold';
        }
        logSystem(`Camera Stream Established.`, 'text-green-500');

        await new Promise(resolve => video.onloadedmetadata = resolve);
        video.play();
        resizeCanvas(); 

    } catch (err) {
        setStatusVisual(`❌ Gagal Start Kamera: Pastikan Izin Diberikan.`, 'text-red-500');
        if(cameraStatus) {
            cameraStatus.textContent = 'FAULT';
            cameraStatus.className = 'text-red-500 font-bold';
        }
        logSystem(`FATAL: Camera failure. ${err.message}.`, 'text-red-500');
    }
}

async function switchCamera(deviceId) {
    setStatusVisual('SWITCHING CAMERA...', 'text-cyan-500', true);
    logSystem(`Switching to camera ID: ${deviceId.substring(0, 8)}...`, 'text-amber-500');
    await startCamera(deviceId);
}

async function initializeApp() {
    setStatusVisual('BOOT SEQUENCE: Loading Neural Engine...', 'text-cyan-500', true);
    logSystem('Application boot sequence initiated.', 'text-cyan-500');

    try {
        // Memuat Model Face-API.js
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('./models')
        ]);
        
        logSystem('Neural Network Models Loaded.', 'text-green-500');
        setStatusVisual('Models Loaded. Starting Camera Stream...', 'text-cyan-400', true);

        await getCameraDevices(); 
        const initialDeviceId = cameraSelect ? cameraSelect.value : null;
        await startCamera(initialDeviceId); 

    } catch (err) {
        setStatusVisual(`❌ FATAL ERROR: Gagal Init Model. Cek folder /models.`, 'text-red-500');
        logSystem(`FATAL: Init failure. ${err.message}`, 'text-red-500');
    }
}

video.addEventListener('play', async () => {
    resizeCanvas(); 

    if (!labeledDescriptors) {
        labeledDescriptors = await loadLabeledImages();
    }
    
    resetTargetData(); // Reset data saat video mulai

    if (detectionInterval === null) {
        detectionInterval = setInterval(detectFace, DETECTION_INTERVAL_MS);
        setStatusVisual('SYSTEM READY. AWAITING TARGET...', 'text-gray-300', true);
        logSystem('Scanning Loop Activated.', 'text-green-500');
    }
});

function resetTargetData() {
    if(userPhotoDisplay) userPhotoDisplay.src = DEFAULT_PHOTO;
    if(userIdDisplay) userIdDisplay.textContent = 'SCANNING...';
    if(userJabatanDisplay) userJabatanDisplay.textContent = '...';
    if(userStatusDisplay) {
        userStatusDisplay.textContent = 'LOCKED';
        userStatusDisplay.className = 'text-lg font-bold text-red-500';
    }
}


async function detectFace() {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (isProcessing) return; // Jangan lakukan apapun jika sedang memproses absensi
    if (video.paused || video.ended || !faceapi.nets.tinyFaceDetector.params) return;
    
    const displaySize = { width: canvas.width, height: canvas.height };

    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

    if(!isProcessing) videoContainer.classList.remove('scan-success');

    if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const { box } = resizedDetections.detection;
        const { landmarks } = resizedDetections;

        drawHolographicMesh(context, landmarks);
        
        // --- GAMBAR EFEK BARU ---
        drawScanningBeam(context, box); // Sinar laser pada wajah
        const nose = landmarks.getNose()[3]; // Titik tengah hidung
        drawTargetLock(context, nose.x, nose.y, box.width * 0.3); // Lingkaran target lock
        
        drawDataTags(context, box, landmarks);

        // Efek suara scanning ringan (opsional, bisa dimatikan jika terlalu berisik)
        // if (Math.random() > 0.8) playSfx('scan'); 

        setStatusVisual('SUBJECT DETECTED. PROCESSING BIOMETRICS...', 'text-amber-500', true);

        let faceLabel = 'UNKNOWN';
        let faceColor = '#FF0055'; 
        let confidence = 0;

        if (labeledDescriptors && labeledDescriptors.length > 0) {
            const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, FACE_MATCHING_THRESHOLD);
            const bestMatch = faceMatcher.findBestMatch(detections.descriptor);
            
            const matchDistance = bestMatch.distance;
            const confidenceRaw = Math.max(0, FACE_MATCHING_THRESHOLD - matchDistance); 
            confidence = (confidenceRaw / FACE_MATCHING_THRESHOLD) * 100;
            updateSystemDiagnostics(confidence);

            if (bestMatch.label !== 'unknown' && matchDistance <= FACE_MATCHING_THRESHOLD) {
                const recognizedId = bestMatch.label;
                const employee = employeeMap[recognizedId] || { nama: `ID:${recognizedId}`, jabatan: 'N/A' };
                
                faceLabel = employee.nama;
                faceColor = '#00FF7F'; 

                // Hanya update jika ID berubah atau belum ada match sebelumnya
                if (!lastKnownMatch || lastKnownMatch.id !== recognizedId) {
                    // Ambil data lengkap dari employeeMap yang sudah dimuat di awal
                    const { nama, jabatan, foto } = employee;
                    if (userPhotoDisplay) userPhotoDisplay.src = foto || DEFAULT_PHOTO;
                    if (userIdDisplay) userIdDisplay.textContent = nama;
                    if (userJabatanDisplay) userJabatanDisplay.textContent = jabatan || 'N/A';
                }
                
                userStatusDisplay.textContent = 'VERIFYING...';
                userStatusDisplay.className = 'text-lg font-bold text-amber-500';
                
                if (!isProcessing) { 
                    setStatusVisual(`ID MATCH: ${employee.nama}. AUTHORIZING...`, 'text-cyan-400', true);
                    isProcessing = true;
                    // Simpan match terakhir sebelum proses absensi
                    lastKnownMatch = { id: recognizedId, box: resizedDetections.detection.box, landmarks: resizedDetections.landmarks, faceLabel: faceLabel, faceColor: faceColor };
                    await processAttendance(recognizedId);
                }

            } else {
                resetTargetData();
                userStatusDisplay.textContent = 'ACCESS DENIED';
                faceLabel = 'DENIED ACCESS';
                faceColor = '#FF0055'; 
                setStatusVisual('SUBJECT NOT AUTHORIZED. IDENTITY DENIED.', 'text-red-500');
                lastKnownMatch = null;
            }
        } else {
            // DB Offline, hanya deteksi wajah
            resetTargetData();
            updateSystemDiagnostics(0);
            userStatusDisplay.textContent = 'DB OFFLINE';
            faceLabel = 'DB OFFLINE';
            faceColor = '#FF00FF'; 
            setStatusVisual('WARNING: NO BIOMETRIC DATABASE FOUND.', 'text-red-500');
            lastKnownMatch = null;
        }
        
        drawTechBracket(context, box.x, box.y, box.width, box.height, faceColor);
        drawMatchLabel(context, box, faceLabel, faceColor); 

    } else {
        // Tidak ada deteksi wajah
        resetTargetData();
        updateSystemDiagnostics(0);
        setStatusVisual('SYSTEM READY. AWAITING TARGET...', 'text-gray-300', true);
        lastKnownMatch = null; 
    }
}

// =============================================================================
// 4. PROSES ABSENSI (Koneksi ke /absensi) - PERBAIKAN OVERLAY
// =============================================================================

async function processAttendance(karyawanId) {
    logSystem(`Sending attendance request for ID: ${karyawanId}`, 'text-amber-500');

    if(successOverlay) {
        successOverlay.style.opacity = 0;
        successOverlay.style.pointerEvents = 'auto';
        
        // INIT OVERLAY BARU
        successOverlay.innerHTML = `
            <div style="
                position: relative;
                text-align: center;
                padding: 60px;
                color: white;
                background: rgba(5, 10, 15, 0.95);
                border: 2px solid ${HEADER_COLOR};
                box-shadow: 0 0 50px rgba(0, 255, 255, 0.2);
                border-radius: 15px;
                max-width: 90%;
                backdrop-filter: blur(10px);
            ">
                <h1 class="text-5xl font-extrabold mb-8 glitch-text" style="
                    font-family: 'Courier New', monospace;
                    color: ${NAME_HIGHLIGHT_COLOR}; 
                    text-shadow: 0 0 20px ${NAME_HIGHLIGHT_COLOR};
                    letter-spacing: 8px;
                    text-transform: uppercase;
                    border-bottom: 1px solid ${NAME_HIGHLIGHT_COLOR};
                    padding-bottom: 20px;
                    display: inline-block;
                ">
                    SELAMAT DATANG DI PUSKESMAS WANA
                </h1>
                <h2 class="text-4xl font-bold mb-6 animate-pulse" id="overlayStatus" style="
                    font-family: 'Courier New', monospace;
                    color: ${HEADER_COLOR};
                    letter-spacing: 3px;
                    text-transform: uppercase;
                ">>> TRANSMITTING DATA <<</h2>
                <p id="overlayMessage" class="text-xl text-cyan-200 font-mono tracking-wider">Processing request on secure server...</p>
            </div>
        `;
        successOverlay.style.background = `rgba(0, 0, 0, 0.95)`;
        successOverlay.style.opacity = 1;
    }

    try {
        const result = await api.postAttendance(karyawanId);
        const serverTimestamp = new Date().toLocaleTimeString('id-ID');

        const statusColor = result.statusColor || 'red';
        const displayColor = (statusColor === 'green' ? 'text-green-500' : (statusColor === 'yellow' ? 'text-amber-500' : 'text-red-500'));
        
        const cleanMessage = result.message.replace(/\*\*|✅\s*/g, '');

        // --- PERBAIKAN UTAMA: Ambil data langsung dari respons server ---
        const employeeData = employeeMap[karyawanId] || {};
        const display_name = result.nama || employeeData.nama || karyawanId;
        const display_jabatan = result.jabatan || employeeData.jabatan || 'N/A';
        const display_foto_base64 = result.foto || employeeData.foto;
        
        const coloredName = `<span class="font-bold text-shadow-lg" style="color: ${NAME_HIGHLIGHT_COLOR}; text-shadow: 0 0 10px ${NAME_HIGHLIGHT_COLOR}, 0 0 5px #000;">${display_name}</span>`;

        let finalStatusText = 'ACCESS GRANTED';
        let finalMessageHTML = '';
        let finalBackground = ABSEN_NORMAL_BG;
        let finalStatusColor = PROFESSIONAL_STATUS_COLOR;
        
        // LOGIKA SUKSES/GAGAL
        if (result.success) {
            
            // Update panel "TARGET DATA" di sisi kiri
            if (userIdDisplay) userIdDisplay.textContent = display_name;
            if (userJabatanDisplay) userJabatanDisplay.textContent = display_jabatan;
            if (userPhotoDisplay) userPhotoDisplay.src = display_foto_base64 || DEFAULT_PHOTO;


            setStatusVisual(cleanMessage, displayColor);
            userStatusDisplay.textContent = 'AUTHORIZED';
            userStatusDisplay.className = 'text-lg font-bold ' + displayColor;
            videoContainer.classList.add('scan-success'); 

            // Gunakan result_code untuk logika yang lebih bersih
            switch (result.result_code) {
                case 'CHECK_IN_SUCCESS':
                    finalStatusText = 'CHECK-IN BERHASIL';
                    finalMessageHTML = `Absensi MASUK atas nama ${coloredName} (${display_jabatan}) telah berhasil dicatat. Selamat Bekerja.`;
                    finalBackground = ABSEN_NORMAL_BG;
                    finalStatusColor = NAME_HIGHLIGHT_COLOR;
                    break;
                case 'CHECK_OUT_SUCCESS':
                    finalStatusText = 'CHECK-OUT BERHASIL';
                    finalMessageHTML = `Absensi PULANG atas nama ${coloredName} (${display_jabatan}) telah berhasil tercatat pada ${serverTimestamp}. Terima kasih.`;
                    finalBackground = ABSEN_NORMAL_BG;
                    finalStatusColor = NAME_HIGHLIGHT_COLOR;
                    break;
                case 'STATUS_CONFIRMED':
                default: // Fallback untuk kasus lain yang sukses
                finalStatusText = 'STATUS CONFIRMED';
                finalMessageHTML = `Sistem mengkonfirmasi ${coloredName}. Absensi Anda untuk hari ini telah tercatat.`;
                finalBackground = ABSEN_NORMAL_BG;
                finalStatusColor = NAME_HIGHLIGHT_COLOR; 
            }

        } else {
            // --- GAGAL (MERAH) ---
            setStatusVisual(cleanMessage, 'text-red-500');
            userStatusDisplay.textContent = 'DENIED';
            userStatusDisplay.className = 'text-lg font-bold text-red-500';

            finalStatusText = 'ACCESS DENIED';
            finalMessageHTML = `${coloredName} | ${cleanMessage}`;
            finalBackground = `radial-gradient(circle, rgba(255,0,85,0.7) 0%, rgba(153,0,0,0.9) 100%)`;
            finalStatusColor = '#FF0055';
        }
        
        // FINAL OVERLAY RENDER (Profesional & Pesan Sambutan)
        if (successOverlay) {
             successOverlay.style.background = finalBackground;
             successOverlay.innerHTML = `
                <div style="
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center; 
                    text-align: center;
                    padding: 50px;
                    background: rgba(0, 0, 0, 0.8);
                    border: 3px solid ${finalStatusColor};
                    box-shadow: 0 0 60px ${finalStatusColor}40, inset 0 0 30px ${finalStatusColor}20;
                    border-radius: 20px;
                    position: relative;
                    max-width: 90%;
                    backdrop-filter: blur(5px);
                ">
                    <!-- Decorative Corners -->
                    <div style="position: absolute; top: 20px; left: 20px; width: 40px; height: 40px; border-top: 4px solid ${finalStatusColor}; border-left: 4px solid ${finalStatusColor};"></div>
                    <div style="position: absolute; top: 20px; right: 20px; width: 40px; height: 40px; border-top: 4px solid ${finalStatusColor}; border-right: 4px solid ${finalStatusColor};"></div>
                    <div style="position: absolute; bottom: 20px; left: 20px; width: 40px; height: 40px; border-bottom: 4px solid ${finalStatusColor}; border-left: 4px solid ${finalStatusColor};"></div>
                    <div style="position: absolute; bottom: 20px; right: 20px; width: 40px; height: 40px; border-bottom: 4px solid ${finalStatusColor}; border-right: 4px solid ${finalStatusColor};"></div>

                    <h1 class="text-5xl lg:text-7xl font-extrabold mb-8 tracking-widest" style="
                        font-family: 'Courier New', monospace;
                        color: #00FFFF;
                        text-shadow: 0 0 15px #00FFFF;
                        text-transform: uppercase;
                        letter-spacing: 5px;
                        border-bottom: 2px solid #00FFFF;
                        padding-bottom: 10px;
                        display: inline-block;
                    ">
                        SELAMAT DATANG DI PUSKESMAS WANA
                    </h1>
                    
                    <h2 class="text-4xl lg:text-6xl font-extrabold mt-2 mb-8" id="overlayStatus" style="
                        font-family: 'Courier New', monospace;
                        color: ${finalStatusColor}; 
                        text-shadow: 0 0 20px ${finalStatusColor};
                        text-transform: uppercase;
                        letter-spacing: 2px;
                    ">
                        [ ${finalStatusText} ]
                    </h2>
                    
                    <div class="text-xl lg:text-3xl mt-4 text-white font-medium font-mono" id="overlayMessage" style="max-width: 900px; line-height: 1.6;">
                        ${finalMessageHTML}
                    </div>

                    <div class="mt-12 pt-6 border-t border-gray-600 w-full">
                        <p class="text-lg text-cyan-200 font-mono tracking-widest">
                            Transaction Time: ${serverTimestamp} <span class="mx-3 text-gray-500">|</span> ID Terminal: A-9
                        </p>
                    </div>
                </div>
            `;
        }
        
        let currentAction = 'Status';
        if (result.result_code === 'CHECK_IN_SUCCESS') {
            currentAction = 'Check-in';
        } else if (result.result_code === 'CHECK_OUT_SUCCESS') {
            currentAction = 'Check-out';
        } else if (result.result_code && result.result_code.includes('FAIL')) {
            currentAction = 'Failed';
        }


        logSystem(`${currentAction} Success for ${display_name}. Cooldown active.`, 'text-green-500');
        lastActionDisplay.textContent = `${currentAction}: ${display_name.substring(0, 15)}... @ ${serverTimestamp}`;
        await new Promise(resolve => setTimeout(resolve, 5000)); 

    } catch (error) {
        logSystem(`Attendance Failed: ${error.message}`, 'text-red-500');
        setStatusVisual(`❌ FAILED: ${error.message}`, 'text-red-500');
        userStatusDisplay.textContent = 'FAILED';
        userStatusDisplay.className = 'text-lg font-bold text-red-500';

        if(successOverlay) {
             successOverlay.style.background = `radial-gradient(circle, rgba(255,0,0,0.8) 0%, rgba(100,0,0,0.95) 100%)`;
             successOverlay.innerHTML = `
                <div style="
                    text-align: center; 
                    padding: 60px; 
                    color: white;
                    background: rgba(20, 0, 0, 0.8);
                    border: 4px solid #FF0055;
                    box-shadow: 0 0 80px #FF0055, inset 0 0 30px #FF0055;
                    border-radius: 20px;
                    max-width: 900px;
                    backdrop-filter: blur(10px);
                ">
                     <h1 class="text-5xl lg:text-7xl font-extrabold mb-8 tracking-widest" style="
                        font-family: 'Courier New', monospace;
                        color: #00FFFF;
                        text-shadow: 0 0 10px #00FFFF;
                        text-transform: uppercase;
                        letter-spacing: 5px;
                    ">
                        SELAMAT DATANG DI PUSKESMAS WANA
                    </h1>
                    <h2 class="text-5xl font-extrabold mb-6 glitch-text" style="
                        font-family: 'Courier New', monospace;
                        color: #FF0055; 
                        text-shadow: 0 0 25px #FF0055;
                        text-transform: uppercase;
                        letter-spacing: 3px;
                    ">
                        ⚠ TRANSMISSION FAILED ⚠
                    </h2>
                    <p class="text-2xl text-white font-mono mb-6 tracking-wide">Gagal terhubung ke server. Cek koneksi jaringan.</p>
                    <div style="background: rgba(255, 0, 0, 0.1); padding: 20px; border: 1px dashed #FF0055; border-radius: 5px;">
                        <p class="text-xl text-amber-300 font-mono">ERROR: ${error.message}</p>
                    </div>
                </div>
             `;
        }
        await new Promise(resolve => setTimeout(resolve, 3000)); 
    } finally {
        isProcessing = false;
        // Kembalikan tema ke IDLE (Cyan)
        if (window.setSystemTheme) window.setSystemTheme('IDLE');
        if(successOverlay) {
            successOverlay.style.opacity = 0;
            successOverlay.style.pointerEvents = 'none';
        }
        logSystem('System ready for next scan.', 'text-gray-300');
        videoContainer.classList.remove('scan-success');
    }
}


// --- START APP (setelah semua HTML siap) ---
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    animateTitle();
    updateClock(); // Panggil sekali agar jam langsung muncul, lalu interval akan mengambil alih
});