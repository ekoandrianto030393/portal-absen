/**
 * scan.js - Biometric Attendance Terminal
 * Fitur Terbaru: Highlight Nama Karyawan dengan Warna Mencolok di Overlay Sukses Absen Masuk.
 * Perbaikan Logika: Pemisahan Absen Masuk Normal vs. Absen Ganda (Masa Kerja) di Overlay.
 */

// --- GLOBAL DOM & VARS ---
const video = document.getElementById('videoElement');
const canvas = document.getElementById('overlay');
const videoContainer = document.getElementById('videoContainer');
const statusMessage = document.getElementById('statusMessage');
const clockDisplay = document.getElementById('clock');
const successOverlay = document.getElementById('successOverlay');
const overlayStatus = document.getElementById('overlayStatus');
const overlayMessage = document.getElementById('overlayMessage');
const userIdDisplay = document.getElementById('userIdDisplay');
const userStatusDisplay = document.getElementById('userStatusDisplay');
const lastActionDisplay = document.getElementById('lastActionDisplay');
const dataStream = document.getElementById('dataStream');
const graphElement = document.getElementById('graph');
const matchThresholdBar = document.getElementById('matchThresholdBar');
const networkStatus = document.getElementById('networkStatus');
const cameraStatus = document.getElementById('cameraStatus');
const dbStatus = document.getElementById('dbStatus');
const systemLog = document.getElementById('systemLog');
const cameraSelect = document.getElementById('cameraSelect');

let labeledDescriptors = null;
let detectionInterval = null;
let isProcessing = false; // KUNCI UTAMA: true saat sedang kirim data/cooldown
let lastKnownMatch = null; 
let employeeMap = {}; 
let currentStream = null;
let videoDevices = []; 

const FACE_MATCHING_THRESHOLD = 0.45; 
const DETECTION_INTERVAL_MS = 100;


// =============================================================================
// 1. MESIN RENDERING VISUAL (HUD)
// =============================================================================

/** Menggambar bracket futuristik di sekitar wajah. */
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

/** Menggambar label nama di atas wajah (Fitur Inti). */
function drawMatchLabel(ctx, box, label, color) {
    // Ukuran Font
    let fontSize = 24;
    if (box.width < 100) fontSize = 18;
    
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'black';

    // Background label
    const textWidth = ctx.measureText(label).width;
    const padding = 10;
    const bgX = box.x + (box.width / 2) - (textWidth / 2) - padding / 2;
    const bgY = box.y - 40;
    const bgW = textWidth + padding;
    const bgH = 30;

    // Gambar background (semi-transparan)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(bgX, bgY, bgW, bgH);

    // Teks di tengah
    ctx.fillStyle = color;
    ctx.fillText(label, box.x + box.width / 2, box.y - 18);

    ctx.shadowBlur = 0;
}


/** Menggambar mesh holografik menggunakan landmark wajah. */
function drawHolographicMesh(ctx, landmarks) {
    const points = landmarks.positions;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0, 26, 255, 0.4)';
    ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';

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

/** Menggambar data tag di samping wajah (simulasi data analisis). */
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
        { text: `ID_SIG: ${Math.floor(Math.random() * 99999)}`, color: '#00FFFF' },
        { text: `DIST: ${(2500 / box.width).toFixed(2)}mm`, color: '#00FFFF' },
        { text: `AXIS: ${tilt}`, color: '#00FF7F' },
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
// 2. FUNGSI UTILITAS & ANIMASI CANGGIH
// =============================================================================

/** Menambahkan pesan ke log sistem dengan timestamp. */
function logSystem(message, color = 'text-green-500') {
    if (!systemLog) return;
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const newLog = document.createElement('p');
    newLog.className = `${color} my-0.5 text-xs`;
    newLog.innerHTML = `[${timestamp}] > ${message}`;

    newLog.style.opacity = 0;
    setTimeout(() => newLog.style.opacity = 1, 10);

    systemLog.prepend(newLog);
    while (systemLog.children.length > 15) {
        systemLog.removeChild(systemLog.lastChild);
    }
}

/** Mengatur status visual dari message bar. */
function setStatusVisual(message, colorClass, isPulsing = false) {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.className = 'text-xl font-bold transition-colors duration-300';
    statusMessage.classList.add(colorClass);

    if (isPulsing) {
        statusMessage.classList.add('animate-pulse');
    } else {
        statusMessage.classList.remove('animate-pulse');
    }
}

/** Menyesuaikan dimensi Canvas agar sesuai dengan Video Element (untuk responsifitas). */
function resizeCanvas() {
    // Gunakan clientWidth/Height dari Video Element yang diatur oleh CSS
    const W = video.clientWidth; 
    const H = video.clientHeight;

    if (W > 0 && H > 0) {
        canvas.width = W;
        canvas.height = H;
        // Pastikan dimensi deteksi FaceAPI juga disesuaikan
        faceapi.matchDimensions(canvas, { width: W, height: H });
        // Opsional: atur ulang ukuran container jika diperlukan
        videoContainer.style.width = `${W}px`;
        videoContainer.style.height = `${H}px`;
        logSystem(`Canvas resized to ${W}x${H}.`, 'text-cyan-500');
    }
}


/** Update jam sistem */
setInterval(() => {
    if(clockDisplay) clockDisplay.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}, 1000);

/** Simulasi data stream dan graph */
function updateDataStream() {
    if(!dataStream) return;
    const chars = '01FfAaBbCcDdEe987654321';
    let result = '';
    for (let i = 0; i < 20; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    const timestamp = new Date().toLocaleTimeString('en-US', {hour12: false, second: '2-digit'});

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
    graphElement.appendChild(bar);
    if (graphElement.children.length > 30) graphElement.removeChild(graphElement.firstChild);
}
setInterval(updateDataStream, 50);
setInterval(updateGraph, 300);


/** Menggambar grid perspektif 3D sederhana di Canvas, mensimulasikan lantai/langit. */
function drawPerspectiveGrid(ctx, opacity = 0.15) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const center = W / 2;
    const horizon = H * 0.9; // Titik horison (di dekat bawah)
    const gridSize = 30; // Jarak antar garis di horison
    const time = Date.now() / 1000; 

    ctx.strokeStyle = `rgba(0, 255, 255, ${opacity})`;
    ctx.lineWidth = 0.5;

    // --- Garis Vertikal (Perspektif) ---
    for (let i = -10; i <= 10; i++) {
        if (i === 0) continue; 

        // Offset per waktu untuk efek bergeser
        const timeOffset = Math.sin(time * 0.5) * 0.5;
        const x1 = center + (i + timeOffset) * gridSize * 4; 
        const x2 = center + (i + timeOffset * 0.1) * gridSize; 

        ctx.beginPath();
        ctx.moveTo(x1, 0); 
        ctx.lineTo(x2, horizon); 
        ctx.stroke();
    }

    // --- Garis Horizontal (Jarak) ---
    // Peningkatan: Menggerakkan garis horizontal untuk efek maju/mundur
    const scrollOffset = (time * 0.8) % 1; // Kecepatan scroll
    
    for (let j = 0; j < 15; j++) {
        // Logika untuk membuat jarak garis semakin rapat ke horison
        const baseOffset = Math.pow(j, 2) * 8;
        const y = horizon - baseOffset + (scrollOffset * 10); 
        
        if (y < 0 || y > H + 5) continue; // Batasi garis di dalam canvas

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }
}


/** Menggambar elemen visual latar belakang yang terus berjalan. */
function drawDynamicBackground(ctx) {
    // 1. Gambar Grid Perspektif (Lantai/Jaring)
    drawPerspectiveGrid(ctx, 0.15); 
    
    // 2. Tambahkan Garis Radar/Sinyal yang bergerak (membuatnya hidup)
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    const time = Date.now() / 100;
    
    // Garis horizontal bergerak
    for (let i = 0; i < 5; i++) {
        // Gerakan sinusoida
        const yPos = (Math.sin(time / 15 + i * 2) + 1) / 2 * ctx.canvas.height;
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(ctx.canvas.width, yPos);
        ctx.stroke();
    }
    
    // --- Efek Scanline Bergerak (BARU) ---
    const scanlineY = (Math.sin(time / 20) + 1) / 2 * ctx.canvas.height; 
    ctx.strokeStyle = 'rgba(10, 60, 224, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, scanlineY);
    ctx.lineTo(ctx.canvas.width, scanlineY);
    ctx.stroke();

    // 3. Titik-titik bintang/noise (memberi tekstur)
    ctx.fillStyle = 'rgba(0, 255, 255, 0.03)';
    for (let i = 0; i < 50; i++) {
        ctx.fillRect(Math.random() * ctx.canvas.width, Math.random() * ctx.canvas.height, 1, 1);
    }
}

/** Menggambar bingkai sudut statis (frame) BARU */
function drawCornerBrackets(ctx, color = '#00FFFF', length = 50) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'square';

    // Kiri Atas
    ctx.beginPath(); ctx.moveTo(0, length); ctx.lineTo(0, 0); ctx.lineTo(length, 0); ctx.stroke();
    // Kanan Atas
    ctx.beginPath(); ctx.moveTo(W - length, 0); ctx.lineTo(W, 0); ctx.lineTo(W, length); ctx.stroke();
    // Kanan Bawah
    ctx.beginPath(); ctx.moveTo(W, H - length); ctx.lineTo(W, H); ctx.lineTo(W - length, H); ctx.stroke();
    // Kiri Bawah
    ctx.beginPath(); ctx.moveTo(length, H); ctx.lineTo(0, H); ctx.lineTo(0, H - length); ctx.stroke();
}


// =============================================================================
// 3. FUNGSI LOGIKA SISTEM & KAMERA (Integrasi Server)
// =============================================================================

/** Memuat deskriptor wajah dari API backend. */
async function loadLabeledImages() {
    setStatusVisual('Memuat database wajah...', 'text-cyan-500', true);
    dbStatus.textContent = 'LOADING...';
    dbStatus.className = 'text-amber-500';
    logSystem('Database Sync Initiated.', 'text-cyan-500');
    
    try {
        const response = await fetch('/api/get_descriptors');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        if (!data.success || data.descriptors.length === 0) {
            throw new Error('Database is empty or failed to retrieve data.');
        }

        const descriptors = data.descriptors.map(item => {
            const descriptorArray = JSON.parse(item.face_descriptor);
            employeeMap[item.id_karyawan] = item.nama;
            return new faceapi.LabeledFaceDescriptors(item.id_karyawan, [new Float32Array(descriptorArray)]);
        });

        setStatusVisual(`${descriptors.length} ID Karyawan dimuat. Siap.`, 'text-green-500');
        dbStatus.textContent = 'ACTIVE';
        dbStatus.className = 'text-green-500';
        logSystem(`Database loaded: ${descriptors.length} records.`, 'text-green-500');
        return descriptors;

    } catch (error) {
        console.error('Error loading descriptors:', error);
        setStatusVisual(`⚠️ Database Error/Empty. Hanya Deteksi Wajah Aktif.`, 'text-red-500');
        dbStatus.textContent = 'OFFLINE';
        dbStatus.className = 'text-red-500';
        logSystem(`Database load failed: ${error.message}`, 'text-red-500');
        return [];
    }
}

/** Mengambil daftar kamera yang tersedia dan mengisi Select Box. */
async function getCameraDevices() {
    videoDevices = [];
    if (!cameraSelect) return;
    cameraSelect.innerHTML = ''; // Kosongkan opsi sebelumnya

    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        logSystem('Browser tidak mendukung MediaDevices API.', 'text-red-500');
        return;
    }
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

        // Tampilkan Select Box hanya jika ada lebih dari 1 kamera
        if (videoDevices.length > 1) { 
            cameraSelect.style.display = 'block'; 
            // Pastikan event listener hanya dipasang sekali
            if (!cameraSelect.dataset.listenerAttached) {
                cameraSelect.addEventListener('change', (e) => switchCamera(e.target.value));
                cameraSelect.dataset.listenerAttached = 'true';
            }
        } else {
            // Sembunyikan jika hanya ada satu atau nol kamera
            cameraSelect.style.display = 'none';
        }

    } catch (error) {
        logSystem(`Error enumerating devices: ${error.message}`, 'text-red-500');
    }
}


/** Menghentikan stream kamera saat ini. */
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

/** Memulai stream kamera dengan deviceId tertentu. */
async function startCamera(deviceId = null) {
    stopCamera(); 
    
    cameraStatus.textContent = 'CONNECTING...';
    cameraStatus.className = 'text-amber-500';
    logSystem('Camera stream starting...', 'text-cyan-500');

    try {
        const constraints = {
            video: {
                deviceId: deviceId ? { exact: deviceId } : undefined
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        video.srcObject = stream;
        
        cameraStatus.textContent = 'ACTIVE';
        cameraStatus.className = 'text-green-500';
        logSystem(`Camera Stream Established.`, 'text-green-500');

        await new Promise(resolve => video.onloadedmetadata = resolve);
        video.play();

    } catch (err) {
        setStatusVisual(`❌ Gagal Start Kamera: ${err.name} - ${err.message}`, 'text-red-500');
        cameraStatus.textContent = 'FAULT';
        cameraStatus.className = 'text-red-500';
        logSystem(`FATAL: Camera failure. ${err.message}`, 'text-red-500');
    }
}

/** Mengganti kamera berdasarkan ID (Dipanggil dari Select Box). */
async function switchCamera(deviceId) {
    // Memberikan feedback visual saat proses switch
    setStatusVisual('Switching Camera...', 'text-cyan-500', true);
    logSystem(`Switching to camera ID: ${deviceId.substring(0, 8)}...`, 'text-amber-500');
    await startCamera(deviceId);
}

/** Inisialisasi model Face-API.js dan Kamera. */
async function initializeApp() {
    setStatusVisual('Booting Neural Engine...', 'text-cyan-500', true);
    logSystem('Application boot sequence initiated.', 'text-cyan-500');

    try {
        // Memuat model dari folder /models
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('./models')
        ]);
        
        logSystem('Neural Network Models Loaded.', 'text-green-500');
        setStatusVisual('Models Loaded. Starting Camera...', 'text-cyan-500', true);

        // 1. Ambil perangkat dan inisialisasi select box
        await getCameraDevices(); 
        // 2. Mulai kamera pertama (atau yang dipilih)
        const initialDeviceId = cameraSelect && cameraSelect.value;
        await startCamera(initialDeviceId); 

    } catch (err) {
        setStatusVisual(`❌ Gagal Init: Pastikan folder /models ada.`, 'text-red-500');
        logSystem(`FATAL: Init failure. ${err.message}`, 'text-red-500');
    }
}

/** Event Listener ketika kamera mulai bermain */
video.addEventListener('play', async () => {
    // Panggil resizeCanvas untuk pertama kalinya saat video dimulai
    resizeCanvas(); 

    if (!labeledDescriptors) {
        labeledDescriptors = await loadLabeledImages();
    }
    
    userIdDisplay.textContent = 'MENUNGGU SCAN';
    userStatusDisplay.textContent = 'STANDBY';

    if (detectionInterval === null) {
        detectionInterval = setInterval(detectFace, DETECTION_INTERVAL_MS);
        setStatusVisual('SYSTEM READY. SCANNING...', 'text-gray-300', true);
        logSystem('Scanning Loop Activated.', 'text-green-500');
    }
});

/** Fungsi Utama Deteksi dan Pengenalan Wajah */
async function detectFace() {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    // 🚨 Pemanggilan elemen visual background konstan
    drawDynamicBackground(context); 
    drawCornerBrackets(context); // Panggil Corner Brackets

    // 🛑 LOGIKA COOLDOWN UNTUK MEMPERTAHANKAN LABEL WAJAH
    if (isProcessing && lastKnownMatch) {
        // Jika sedang cooldown, gambar ulang label terakhir dan HENTIKAN deteksi berat
        const { box, faceLabel, faceColor, landmarks } = lastKnownMatch;
        
        if (box && landmarks) {
            // Gambar di atas background dinamis
            drawTechBracket(context, box.x, box.y, box.width, box.height, faceColor);
            drawMatchLabel(context, box, faceLabel, faceColor);
            drawHolographicMesh(context, landmarks); 
            drawDataTags(context, box, landmarks); 
        }

        return; // Hentikan fungsi deteksi berat saat cooldown
    }

    if (isProcessing) return;
    if (video.paused || video.ended || !faceapi.nets.tinyFaceDetector.params) return;
    
    const displaySize = { width: video.videoWidth, height: video.videoHeight };

    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

    if(!isProcessing) videoContainer.classList.remove('scan-success');

    if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const { box } = resizedDetections.detection;
        const { landmarks } = resizedDetections;

        drawHolographicMesh(context, landmarks);
        drawDataTags(context, box, landmarks);

        setStatusVisual('SUBJECT DETECTED. PROCESSING BIOMETRICS...', 'text-amber-500', true);

        let faceLabel = 'UNKNOWN';
        let faceColor = '#FF0055'; // Merah

        if (labeledDescriptors && labeledDescriptors.length > 0) {
            const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, FACE_MATCHING_THRESHOLD);
            const bestMatch = faceMatcher.findBestMatch(detections.descriptor);

            const matchDistance = bestMatch.distance;
            // Hitung confidence score
            const confidenceRaw = Math.max(0, FACE_MATCHING_THRESHOLD - matchDistance); 
            const confidence = (confidenceRaw / FACE_MATCHING_THRESHOLD) * 100;
            
            // Update Match Bar
            if(matchThresholdBar) {
                matchThresholdBar.style.width = `${Math.min(100, confidence)}%`;
                matchThresholdBar.style.background = (confidence >= 70) ? 'linear-gradient(90deg, #00FF7F, #2600ffff)' : (confidence >= 40 ? 'linear-gradient(90deg, #FFD700, #FFB300)' : 'linear-gradient(90deg, #FF0055, #FF5500)');
                matchThresholdBar.className = (confidence >= 40) ? 'loader-fill' : 'loader-fill-red';
            }

            if (bestMatch.label !== 'unknown' && matchDistance <= FACE_MATCHING_THRESHOLD) {
                // --- WAJAH DIKENALI ---
                const recognizedId = bestMatch.label;
                const recognizedName = employeeMap[recognizedId] || `ID:${recognizedId}`;
                
                faceLabel = recognizedName; 
                faceColor = '#00FF7F'; // Hijau

                // SIMPAN DATA WAJAH TERAKHIR SEBELUM MEMULAI PROSES ABSENSI
                lastKnownMatch = {
                    box: resizedDetections.detection.box,
                    landmarks: resizedDetections.landmarks,
                    faceLabel: faceLabel,
                    faceColor: faceColor
                };

                userIdDisplay.textContent = recognizedName;
                userStatusDisplay.textContent = 'VERIFYING...';
                userStatusDisplay.classList.remove('text-red-500');
                userStatusDisplay.classList.add('text-amber-500');
                
                // 🛑 PERBAIKAN: Blokir deteksi kedua DITEMPAT ini 🛑
                if (!isProcessing) { 
                    setStatusVisual(`ID MATCH: ${recognizedName}. AUTHORIZING...`, 'text-cyan-400', true);
                    isProcessing = true; // Pasang isProcessing = true sebelum await
                    await processAttendance(recognizedId);
                }

            } else {
                // --- WAJAH TIDAK DIKENALI ---
                userIdDisplay.textContent = 'UNKNOWN SUBJECT';
                userStatusDisplay.textContent = 'DENIED';
                userStatusDisplay.classList.remove('text-green-500', 'text-amber-500');
                userStatusDisplay.classList.add('text-red-500');
                faceLabel = 'DENIED ACCESS';
                faceColor = '#FF0055'; // Merah
                
                lastKnownMatch = {
                    box: resizedDetections.detection.box, 
                    landmarks: resizedDetections.landmarks,
                    faceLabel: faceLabel,
                    faceColor: faceColor
                };
                setStatusVisual('SUBJECT NOT AUTHORIZED. IDENTITY DENIED.', 'text-red-500');
            }
        } else {
            // --- TIDAK ADA DESKRIPTOR/DB KOSONG ---
            userIdDisplay.textContent = 'FACE DETECTED';
            userStatusDisplay.textContent = 'DB OFFLINE';
            faceLabel = 'DB OFFLINE';
            faceColor = '#FF00FF'; // Magenta
            setStatusVisual('WARNING: NO BIOMETRIC DATABASE FOUND.', 'text-red-500');
            
             lastKnownMatch = {
                box: resizedDetections.detection.box, 
                landmarks: resizedDetections.landmarks,
                faceLabel: faceLabel,
                faceColor: faceColor
            };
        }
        
        // Gambar bracket dan label berdasarkan hasil akhir
        drawTechBracket(context, box.x, box.y, box.width, box.height, faceColor);
        drawMatchLabel(context, box, faceLabel, faceColor); 

    } else {
        // --- TIDAK ADA WAJAH ---
        // Background sudah digambar di awal, hanya reset UI teks
        userIdDisplay.textContent = 'SCANNING...';
        userStatusDisplay.textContent = 'LOCKED';
        userStatusDisplay.classList.remove('text-green-500', 'text-amber-500');
        userStatusDisplay.classList.add('text-red-500');
        setStatusVisual('SYSTEM READY. SCANNING...', 'text-gray-300', true);
        if(matchThresholdBar) matchThresholdBar.style.width = '0%';
        lastKnownMatch = null; // Reset jika wajah hilang
    }
}

// =============================================================================
// 4. PROSES ABSENSI (HANDLER - Koneksi ke /absensi) - PERBAIKAN LOGIKA DISINI
// =============================================================================

/** Mengirim data absensi ke server dan menangani respons. */
async function processAttendance(karyawanId) {
    logSystem(`Sending attendance request for ID: ${karyawanId}`, 'text-amber-500');

    // 1. Tampilkan Overlay sebelum request (untuk feedback cepat)
    if(successOverlay) {
        successOverlay.style.opacity = 0; // Pastikan transisi mulai dari 0
        successOverlay.style.pointerEvents = 'auto';
        // Atur status awal loading di overlay
        overlayStatus.textContent = 'TRANSMITTING DATA...';
        overlayMessage.innerHTML = 'Processing request on secure server...'; 
        overlayStatus.style.color = 'rgba(48, 240, 9, 0.95)';
        successOverlay.style.background = `rgba(0, 0, 0, 0.9)`;
        successOverlay.style.opacity = 1;
    }


    try {
        const response = await fetch('/absensi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_karyawan: karyawanId })
        });

        if (!response.ok) throw new Error('Server returned an error status.');
        
        const result = await response.json();
        const serverTimestamp = new Date().toLocaleTimeString('id-ID');
        const statusColor = result.statusColor || 'red';
        const displayColor = (statusColor === 'green' ? 'text-green-500' : (statusColor === 'yellow' ? 'text-amber-500' : 'text-red-500'));
        const hexColor = (statusColor === 'green' ? '#00FF7F' : (statusColor === 'yellow' ? '#013fe9ff' : '#FF0055'));

        const cleanMessage = result.message.replace(/\*\*/g, '');
        const currentAction = cleanMessage.includes('PULANG') ? 'Check-out' : (cleanMessage.includes('MASUK') ? 'Check-in' : 'Status');

        // --- 2. LOGIKA UPDATE VISUAL SETELAH RESPON SERVER ---
        
        if (result.success) {
            
            // Tentukan nama yang terdeteksi
            const display_name = result.karyawanName || employeeMap[karyawanId] || karyawanId; 
            
            // WARNA BARU UNTUK NAMA (Kuning Emas, Mencolok)
            const nameColor = '#220de0fa'; 
            // Bungkus nama dengan tag span HTML untuk mengatur warna, font-weight, dan text-shadow
            const coloredName = `<span style="color: ${nameColor}; font-weight: 900; text-shadow: 0 0 10px ${nameColor}, 0 0 5px #000;">${display_name}</span>`;

            let finalMessageHTML = cleanMessage.replace(/✅\s*/, '');
            
            // --- SUKSES (HIJAU/KUNING) ---
            setStatusVisual(cleanMessage, displayColor);
            userStatusDisplay.textContent = 'AUTHORIZED';
            userStatusDisplay.className = 'text-2xl font-extrabold ' + displayColor;
            videoContainer.classList.add('scan-success'); 

            if(successOverlay) {
                
                // 🛑 LOGIKA SPESIAL 1: ABSEN MASUK PERTAMA KALI ATAU PULANG 🛑
                // Kunci: success=true, mengandung 'telah tercatat', DAN TIDAK mengandung 'masa kerja'
                if (finalMessageHTML.includes('telah tercatat') && !finalMessageHTML.includes('masa kerja')) { 
                    
                    // Notifikasi Spesial Absen Masuk/Pulang
                    overlayStatus.textContent = finalMessageHTML.includes('PULANG') ? 'CHECK-OUT BERHASIL' : 'SELAMAT DATANG DI PUSKESMAS WANA!';
                    overlayStatus.style.color = nameColor; // Menggunakan warna emas untuk status
                    
                    // Pesan: Nama Emas/Putih
                    finalMessageHTML = finalMessageHTML.includes('PULANG') ? 
                        `Absensi PULANG atas nama ${coloredName} telah berhasil tercatat. Terima kasih.` :
                        `Absensi MASUK atas nama ${coloredName} telah berhasil dicatat. Selamat Bekerja.`;

                    // Latar belakang Absen Masuk/Pulang (radial Hijau yang menawan)
                    successOverlay.style.background = `radial-gradient(circle, rgba(0,255,127,0.7) 0%, hsla(135, 97%, 41%, 0.90) 100%)`; 

                // 🛑 LOGIKA SPESIAL 2: ABSEN GANDA / SUDAH DI DALAM MASA KERJA 🛑
                // Kunci: success=true, mengandung 'masa kerja'
                } else if (finalMessageHTML.includes('Anda sedang dalam masa kerja')) {

                    // Notifikasi Absen Ganda (Status Di Konfirmasi)
                    overlayStatus.textContent = 'SELAMAT DATANG DI PUSKESMAS WANA';
                    overlayStatus.style.color = nameColor; // Kuning Emas
                    
                    // Pesan: Nama Hijau, sisanya Putih (menunjukkan status OK)
                    const activeName = `<span style="color: #00FF7F; font-weight: 900; text-shadow: 0 0 10px #00FF7F, 0 0 5px #eb380bff;">${display_name}</span>`;
                    finalMessageHTML = `Anda sudah tercatat masuk. Status saat ini: Bekerja. Cek-in atas nama ${activeName} dikonfirmasi ulang.`;

                    // Latar belakang Kuning/Warning
                    successOverlay.style.background = `radial-gradient(circle, rgba(255,215,0,0.7) 0%, hsla(120, 100%, 50%, 0.90) 100%)`; 

                } else {
                    // --- KASUS UMUM / FALLBACK ---
                    overlayStatus.textContent = 'ACCESS GRANTED';
                    overlayStatus.style.color = hexColor;
                    successOverlay.style.background = `rgba(0, 150, 0, 0.8)`; 
                    
                    // Sisipkan nama berwarna jika tidak ada di pesan
                    finalMessageHTML = finalMessageHTML.replace(/(telah tercatat|masuk telah tercatat)/i, `atas nama ${coloredName} telah tercatat.`);
                }
                
                // Gunakan .innerHTML untuk merender tag <span> berwarna
                overlayMessage.innerHTML = finalMessageHTML; 
            }

            userIdDisplay.textContent = display_name; // Menggunakan nama yang sama di sidebar
            lastActionDisplay.textContent = `${serverTimestamp} (${currentAction})`;
            logSystem(`Attendance successful: ${userIdDisplay.textContent} (${currentAction})`, displayColor);

            if (lastKnownMatch) lastKnownMatch.faceColor = hexColor;

        } else {
            // --- GAGAL / DENIED (MERAH/KUNING) ---
            setStatusVisual(`❌ ${cleanMessage}`, displayColor);
            userStatusDisplay.textContent = (statusColor === 'yellow') ? 'ALERT' : 'DENIED';
            userStatusDisplay.className = 'text-2xl font-extrabold ' + displayColor;
            videoContainer.classList.remove('scan-success');

            if(successOverlay) {
                overlayStatus.textContent = (statusColor === 'yellow') ? 'ACCESS ALERT' : 'ACCESS DENIED';
                overlayMessage.innerHTML = cleanMessage.replace(/❌\s*/, '');
                overlayStatus.style.color = hexColor; 
                
                // Latar belakang Merah atau Kuning
                successOverlay.style.background = (statusColor === 'yellow') ? 
                    `radial-gradient(circle, rgba(255,215,0,0.7) 0%, rgba(255,165,0,0.9) 100%)` :
                    `radial-gradient(circle, rgba(255,0,85,0.7) 0%, rgba(150,0,0,0.9) 100%)`; 
            }
            logSystem(`Attendance denied: ${karyawanId}. Status: ${cleanMessage}`, displayColor);

            if (lastKnownMatch) lastKnownMatch.faceColor = hexColor;
        }

    } catch (error) {
        // --- KONEKSI GAGAL ---
        console.error('Attendance processing failed:', error);
        setStatusVisual(`FATAL ERROR: Failed to connect to server.`, 'text-red-500');
        userStatusDisplay.textContent = 'SERVER FAIL';
        userStatusDisplay.className = 'text-2xl font-extrabold text-red-500';
        networkStatus.textContent = 'ERROR';
        networkStatus.className = 'text-red-500';
        logSystem(`Network Error: ${error.message}`, 'text-red-500');

        if(successOverlay) {
            overlayStatus.textContent = 'SYSTEM OFFLINE';
            overlayMessage.innerHTML = `Koneksi ke server gagal. Coba lagi dalam beberapa saat.<br>Error: ${error.message}`;
            overlayStatus.style.color = '#FF0055'; 
            successOverlay.style.background = `radial-gradient(circle, rgba(255,0,85,0.7) 0%, rgba(150,0,0,0.9) 100%)`;
        }

    } finally {
        // 3. Cooldown dan Hapus Overlay
        setTimeout(() => {
            isProcessing = false;
            // Hanya sembunyikan jika tidak ada proses baru yang dimulai
            if (successOverlay) {
                successOverlay.style.opacity = 0;
                successOverlay.style.pointerEvents = 'none';
            }
        }, 5000); // Overlay ditampilkan selama 5 detik
        
        // Atur ulang status sidebar ke Standby setelah sukses/gagal singkat
        setTimeout(() => {
            if(!isProcessing) {
                userStatusDisplay.textContent = 'STANDBY';
                userStatusDisplay.classList.remove('text-green-500', 'text-amber-500', 'text-red-500');
                userStatusDisplay.classList.add('text-gray-500');
                videoContainer.classList.remove('scan-success');
            }
        }, 5500);
    }
}


// =============================================================================
// 5. INISIALISASI
// =============================================================================

// Tambahkan event listener untuk resize saat window berubah
window.addEventListener('resize', resizeCanvas);

// Panggil fungsi inisialisasi aplikasi saat DOM selesai dimuat
document.addEventListener('DOMContentLoaded', initializeApp);