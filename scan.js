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
const userEmotionDisplay = document.getElementById('userEmotionDisplay'); // NEW: Emotion Display
const userPhotoDisplay = document.getElementById('userPhotoDisplay'); 
const photoContainer = document.getElementById('photoContainer'); // Container foto untuk efek scan
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
const dbStatus = document.getElementById('dbStatus');
const personnelRoster = document.getElementById('personnelRoster');
const matchThresholdBar = document.getElementById('matchThresholdBar');
const attendanceLog = document.getElementById('attendanceLog');
const diagnosticList = document.getElementById('diagnosticList');

// CORNER CARD ELEMENTS
const cornerProfileCard = document.getElementById('corner-profile-card');
const cornerPhoto = document.getElementById('corner-photo');
const cornerName = document.getElementById('corner-name');
const cornerJabatan = document.getElementById('corner-jabatan');
const cornerId = document.getElementById('corner-id');
const cornerStatus = document.getElementById('corner-status');


const cameraSelect = document.getElementById('cameraSelect');

const stealthToggle = document.getElementById('stealthToggle');
const stealthIcon = document.getElementById('stealthIcon');

let labeledDescriptors = null;
let isDetectionActive = false; // Ganti interval ID dengan flag boolean
let isProcessing = false; // Kunci: true saat sedang kirim data/cooldown
let lastKnownMatch = null; 
let employeeMap = {}; 
let currentStream = null; // Variabel untuk stream kamera aktif
let videoDevices = []; 
// turunkan jadi 80, namun jangan dibawah itu
const DETECTION_INTERVAL_MS = 100; // Interval scan dalam milidetik
const DEFAULT_PHOTO = ''; // Path ke foto default/placeholder jika diperlukan
const SUCCESS_COOLDOWN_MS = 15000; // Jeda 15 detik setelah berhasil scan (Mencegah spam)

// VARS UNTUK EFEK DECRYPT TEXT
let targetLabel = '';
let currentDisplayLabel = '';
let decryptionFrame = 0;
let isStealthMode = false; // Default: Suara Aktif
let confidenceHistory = []; // Untuk grafik live
let recognition; // Variabel untuk Voice Recognition
let faceParticles = []; // NEW: Global particle array

// --- AUDIO & VOICE ENGINE (WEB AUDIO API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- NEW: AUDIO ANALYSER FOR VISUALIZER ---
const audioAnalyser = audioCtx.createAnalyser();
audioAnalyser.fftSize = 128; // Resolusi visualizer
audioAnalyser.connect(audioCtx.destination); // Sambungkan ke output speaker

// Resume audio context saat user berinteraksi pertama kali (Browser Policy)
document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
}, { once: true });

const SoundFX = {
    play: (type) => {
        if (isStealthMode) return; // Mute jika Stealth Mode aktif
        if (audioCtx.state === 'suspended') return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioAnalyser); // Sambungkan ke Analyser, bukan langsung destination
        const now = audioCtx.currentTime;

        if (type === 'scan') {
            // High tech chirp
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'comms_open') {
            // Suara "bip" sebelum AI bicara
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioAnalyser);
            const now = audioCtx.currentTime;
            osc.type = 'square';
            osc.frequency.setValueAtTime(1500, now);
            gain.gain.setValueAtTime(0.02, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'success') {
            // Ascending Chime
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now); // A4
            osc.frequency.setValueAtTime(554, now + 0.1); // C#5
            osc.frequency.setValueAtTime(659, now + 0.2); // E5
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.6);
            osc.start(now);
            osc.stop(now + 0.6);
        } else if (type === 'error') {
            // Low Buzz
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'type') {
            // NEW: Mechanical Key Click / Data Tick
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioAnalyser);
            const now = audioCtx.currentTime;
            osc.type = 'square';
            osc.frequency.setValueAtTime(800 + Math.random() * 200, now);
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
            osc.start(now);
            osc.stop(now + 0.03);
        }
    },
    speak: (text) => {
        if (isStealthMode) return; // Mute jika Stealth Mode aktif
        if ('speechSynthesis' in window) {
            SoundFX.play('comms_open'); // EFEK BARU: Suara "bip" sebelum bicara
            // Cancel previous speech
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0; // Sedikit lebih lambat untuk kejelasan
            utterance.pitch = 0.6; // Jauh lebih rendah untuk suara robotik/AI
            utterance.volume = 0.9;
            
            // Coba cari suara bahasa Inggris yang bagus (Google US English biasanya ada)
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) || voices.find(v => v.lang === 'en-US');
            if (preferredVoice) utterance.voice = preferredVoice;
            // Beri jeda sedikit agar suara "bip" selesai
            setTimeout(() => {
                window.speechSynthesis.speak(utterance);
            }, 50);
        }
    }
};

// --- NEW: DRAW AUDIO VISUALIZER LOOP ---
function initAudioVisualizer() {
    const canvas = document.getElementById('aiVoiceVisualizer');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bufferLength = audioAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function renderFrame() {
        requestAnimationFrame(renderFrame);
        audioAnalyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Style Visualizer
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2; // Scale height
            
            // Warna Gradient Cyan ke Ungu
            ctx.fillStyle = `rgba(0, 255, 255, ${barHeight / 100})`;
            ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight); // Center vertical
            x += barWidth + 1;
        }
    }
    renderFrame();
}

// --- NEW: IDLE RADAR EFFECT ---
function drawIdleRadar(ctx, x, y, radius) {
    const time = Date.now() / 1000;
    ctx.save();
    ctx.translate(x, y);
    
    // Rotating Radar Sweep
    ctx.rotate(time);
    const gradient = ctx.createConicGradient(0, 0, 0);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
    gradient.addColorStop(0.8, 'rgba(0, 255, 255, 0)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0.1)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// --- STEALTH MODE LISTENER ---
if (stealthToggle) {
    stealthToggle.addEventListener('click', () => {
        isStealthMode = !isStealthMode;
        
        if (isStealthMode) {
            // MODE SENYAP AKTIF
            stealthToggle.textContent = '[ ON ]';
            stealthToggle.className = 'bg-red-900/20 border border-red-500 text-red-500 text-[10px] px-3 py-1 font-mono shadow-[0_0_10px_rgba(255,0,0,0.5)] transition-all duration-300';
            if(stealthIcon) stealthIcon.className = 'w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_#FF0000]';
            logSystem('STEALTH MODE: ACTIVE. Audio Output Disabled.', 'text-red-500');
            if ('speechSynthesis' in window) window.speechSynthesis.cancel(); // Hentikan suara yg sedang bicara
        } else {
            // MODE NORMAL
            stealthToggle.textContent = '[ OFF ]';
            stealthToggle.className = 'bg-transparent border border-cyan-500/50 text-cyan-400 text-[10px] px-3 py-1 font-mono hover:bg-cyan-900/30 transition-all duration-300';
            if(stealthIcon) stealthIcon.className = 'w-2 h-2 rounded-full bg-gray-600';
            logSystem('STEALTH MODE: DISENGAGED. Audio Online.', 'text-cyan-500');
        }
    });
}

let FACE_MATCHING_THRESHOLD = 0.36;
// --- DEFINISI WARNA (Futuristik) ---
const PROFESSIONAL_STATUS_COLOR = '#00FF7F'; 
const NAME_HIGHLIGHT_COLOR = '#FFD700'; // Kuning Emas Neon
const HEADER_COLOR = '#00FFFF'; 
const ABSEN_GANDA_BG = 'radial-gradient(circle, rgba(255,165,0,0.8) 0%, rgba(204,133,0,0.95) 100%)'; 
const ABSEN_NORMAL_BG = 'radial-gradient(circle, rgba(0,255,127,0.8) 0%, rgba(0,100,0,0.95) 100%)';
const AGENCY_NAME = 'PUSKESMAS WANA'; // Nama Instansi Global

// --- NEW FEATURE: DYNAMIC SYSTEM THEME ---
function setSystemTheme(status) {
    const root = document.documentElement;
    let primary, secondary, glow;
    
    switch(status) {
        case 'SUCCESS': 
            primary = '#00FF7F'; secondary = '#008800'; glow = 'rgba(0, 255, 127, 0.6)'; 
            break;
        case 'ERROR': 
            primary = '#FF0055'; secondary = '#880000'; glow = 'rgba(255, 0, 85, 0.6)'; 
            break;
        case 'SCANNING': 
            primary = '#00FFFF'; secondary = '#0088FF'; glow = 'rgba(0, 255, 255, 0.6)'; 
            break;
        default: // IDLE
            primary = '#00FFFF'; secondary = '#0088FF'; glow = 'rgba(0, 255, 255, 0.3)';
    }
    root.style.setProperty('--hud-primary', primary);
    root.style.setProperty('--hud-secondary', secondary);
    root.style.setProperty('--hud-glow', glow);
    
    // TRIGGER PERUBAHAN WARNA DUNIA 3D (BABYLON.JS)
    if (window.update3DTheme) window.update3DTheme(status);
}

// --- NEW FEATURE: SENSOR VISION MODES ---
window.setVisionMode = (mode) => {
    const v = document.getElementById('videoElement');
    if(!v) return;
    
    // Reset filters
    v.style.filter = 'none';
    
    if(mode === 'thermal') {
        v.style.filter = 'url(#thermal-filter) contrast(1.2) saturate(1.5)';
        logSystem('SENSOR: THERMAL OPTICS ENGAGED', 'text-red-500');
    } else if (mode === 'night') {
        v.style.filter = 'url(#night-vision) brightness(1.2) contrast(1.1)';
        logSystem('SENSOR: NIGHT VISION ENGAGED', 'text-green-500');
    } else {
        logSystem('SENSOR: STANDARD OPTICS RESTORED', 'text-cyan-500');
    }
    SoundFX.play('comms_open');
};

// --- FITUR BARU: VOICE COMMAND SYSTEM (JARVIS STYLE) ---
function initVoiceCommands() {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
        logSystem("Voice Module: Not Supported by Browser", "text-gray-500");
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US'; // Deteksi Bahasa Inggris (Lebih akurat untuk command teknis)
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const last = event.results.length - 1;
        const command = event.results[last][0].transcript.trim().toLowerCase();
        logSystem(`VOICE CMD: "${command}"`, "text-purple-400");
        
        // Logika Perintah
        if (command.includes('thermal')) setVisionMode('thermal');
        else if (command.includes('night') || command.includes('vision')) setVisionMode('night');
        else if (command.includes('optical') || command.includes('normal') || command.includes('reset')) setVisionMode('normal');
        else if (command.includes('status') || command.includes('report')) SoundFX.speak('System Nominal. Database Online.');
        else if (command.includes('admin') || command.includes('override')) toggleAdminPanel();
        else if (command.includes('stealth') || command.includes('silent')) document.getElementById('stealthToggle').click();
    };

    recognition.onend = () => { if(isDetectionActive) recognition.start(); }; // Auto restart
    
    try { recognition.start(); logSystem("Voice Command: LISTENING...", "text-purple-400"); } 
    catch(e) { console.warn("Voice start error", e); }
}

// =============================================================================
// 1. MESIN RENDERING VISUAL CANVAS (DRAWING Face-API)
// =============================================================================

function drawTechBracket(ctx, x, y, w, h, color) {
    const lineLen = w / 4;
    const cornerSize = 3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    
    // Kiri Atas
    ctx.beginPath(); ctx.moveTo(x, y + lineLen); ctx.lineTo(x, y); ctx.lineTo(x + lineLen, y); ctx.stroke();
    // Kanan Atas
    ctx.beginPath(); ctx.moveTo(x + w - lineLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + lineLen); ctx.stroke();
    // Kanan Bawah
    ctx.beginPath(); ctx.moveTo(x + w, y + h - lineLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - lineLen, y + h); ctx.stroke();
    // Kiri Bawah
    ctx.beginPath(); ctx.moveTo(x + lineLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - lineLen); ctx.stroke();
    
    // Corner Dots (Aksen Tambahan)
    ctx.fillStyle = color;
    ctx.fillRect(x - 1, y - 1, cornerSize, cornerSize);
    ctx.fillRect(x + w - cornerSize + 1, y - 1, cornerSize, cornerSize);
    ctx.fillRect(x + w - cornerSize + 1, y + h - cornerSize + 1, cornerSize, cornerSize);
    ctx.fillRect(x - 1, y + h - cornerSize + 1, cornerSize, cornerSize);
    
    ctx.shadowBlur = 0;
}

// --- FITUR BARU: HEXAGONAL FORCE FIELD OVERLAY ---
function drawHexGridOverlay(ctx, box, color) {
    const r = 12; // Radius hexagon
    const w = r * 2 * 0.866;
    const h = r * 1.5;
    const time = Date.now() / 500;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    
    // Clip area ke dalam kotak wajah
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.clip();

    // Gambar pola honeycomb
    for (let y = box.y - h; y < box.y + box.height + h; y += h) {
        for (let x = box.x - w; x < box.x + box.width + w; x += w) {
            const xOffset = (Math.floor((y - box.y) / h) % 2) * (w / 2);
            const hx = x + xOffset;
            const hy = y;
            
            // Efek gelombang scan
            const dist = Math.abs((hy - box.y) - (time * 100 % box.height));
            const isActive = dist < 30;

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                ctx.lineTo(hx + r * Math.cos(i * Math.PI / 3), hy + r * Math.sin(i * Math.PI / 3));
            }
            ctx.closePath();

            if (isActive) {
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.15;
                ctx.fill();
                ctx.globalAlpha = 0.6;
                ctx.stroke();
            } else {
                ctx.globalAlpha = 0.05;
                ctx.stroke();
            }
        }
    }
    ctx.restore();
}

// --- FITUR BARU: TOPOGRAPHIC FACE MAPPING ---
function drawTopographicFeatures(ctx, landmarks, color) {
    const jaw = landmarks.getJawOutline();
    const nose = landmarks.getNose();
    const time = Date.now() / 1000;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    
    // EFEK BARU: Garis putus-putus yang mengalir (seperti data dikirim)
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -time * 20; 

    // Hubungkan rahang ke hidung (Kontur Pipi)
    ctx.beginPath();
    for(let i=0; i<jaw.length; i+=2) {
        ctx.moveTo(jaw[i].x, jaw[i].y);
        // Tarik garis ke tengah hidung
        ctx.bezierCurveTo(
            jaw[i].x, jaw[i].y, 
            (jaw[i].x + nose[3].x)/2, (jaw[i].y + nose[3].y)/2 + 20, 
            nose[3].x, nose[3].y
        );
    }
    ctx.stroke();
    ctx.restore();
}

function drawHolographicMesh(ctx, landmarks) {
    const points = landmarks.positions;
    const time = Date.now() / 1000;
    
    // --- EFEK BARU: PROGRESSIVE SCANNING (WAJAH DIGAMBAR) ---
    // Hitung batas atas dan bawah wajah
    const ys = points.map(p => p.y);
    const minY = Math.min(...ys) - 10;
    const maxY = Math.max(...ys) + 10;
    const height = maxY - minY;
    
    // Garis scan bergerak dari atas ke bawah setiap 1.5 detik
    const scanPhase = (time % 1.5) / 1.5; 
    const scanY = minY + (scanPhase * height);
    
    ctx.save();
    
    // 1. TRIANGULATION MESH (Low Poly Cyber Look)
    // Logic: Hanya gambar jika titik berada di atas garis scan
    const tri = (i, j, k) => {
        const py = (points[i].y + points[j].y + points[k].y) / 3;
        
        // Jika di bawah garis scan, jangan gambar (belum ter-scan)
        if (py > scanY) return;

        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.lineTo(points[k].x, points[k].y);
        ctx.closePath();
        
        // EFEK "HOT EDGE": Segitiga yang baru saja di-scan menyala putih terang
        const dist = Math.abs(py - scanY);
        if (dist < 25) {
            // Putih terang memudar ke Cyan
            const intensity = 1 - (dist / 25);
            ctx.strokeStyle = `rgba(255, 255, 255, ${intensity})`; 
            ctx.fillStyle = `rgba(0, 255, 255, ${intensity * 0.6})`;
            ctx.fill();
            ctx.lineWidth = 1.5;
        } else {
            // Sudah stabil (Cyan redup)
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
            ctx.fillStyle = 'rgba(0, 255, 255, 0.02)'; 
            ctx.lineWidth = 0.5;
        }
        ctx.stroke();
    };

    // Manual Triangulation for key areas (Nose, Eyes, Cheeks, Chin)
    tri(27, 31, 28); tri(28, 31, 35); tri(28, 35, 29); tri(29, 35, 30); // Nose
    tri(21, 22, 27); tri(17, 36, 21); tri(22, 42, 26); // Forehead/Eyes
    tri(31, 2, 48); tri(35, 14, 54); // Cheeks
    tri(48, 57, 54); tri(57, 8, 54); tri(57, 48, 8); // Chin

    // 2. REGION LINES (Outline) - Digambar progresif
    ctx.lineWidth = 1;
    const regions = [
        [0, 16, false], [17, 21, false], [22, 26, false], [27, 30, false],
        [31, 35, false], [36, 41, true], [42, 47, true], [48, 59, true], [60, 67, true]
    ];
    
    regions.forEach(region => {
        const start = region[0];
        const end = region[1];
        const isLoop = region[2];
        
        ctx.beginPath();
        // Loop manual untuk cek setiap segmen garis
        const indices = [];
        for (let i = start; i <= end; i++) indices.push(i);
        if (isLoop) indices.push(start);

        for (let i = 0; i < indices.length - 1; i++) {
            const p1 = points[indices[i]];
            const p2 = points[indices[i+1]];
            
            // Hanya gambar jika titik berada di atas garis scan
            if (p1.y <= scanY && p2.y <= scanY) {
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
            }
        }
        ctx.strokeStyle = `rgba(0, 255, 255, 0.5)`;
        ctx.stroke();
    });

    // 3. GLOWING NODES (Hanya yang sudah di-scan)
    for (let i = 0; i < points.length; i++) {
        if (i % 2 !== 0) continue; 
        const pt = points[i];
        if (pt.y > scanY) continue; // Skip jika belum di-scan

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.2, 0, Math.PI * 2);
        
        // Efek sparkle saat baru muncul
        if (scanY - pt.y < 15) {
             ctx.fillStyle = '#FFFFFF';
             ctx.shadowBlur = 8;
             ctx.shadowColor = '#FFFFFF';
        } else {
             ctx.fillStyle = '#00FFFF';
             ctx.shadowBlur = 0;
        }
        ctx.fill();
    }
    
    // 4. LASER SCAN LINE (Garis Horizontal Pemicu)
    ctx.beginPath();
    ctx.moveTo(points[0].x - 25, scanY);
    ctx.lineTo(points[16].x + 25, scanY);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00FFFF';
    ctx.shadowBlur = 15;
    ctx.stroke();
    
    // Efek partikel jatuh dari garis scan
    if (Math.random() > 0.7) {
        ctx.fillStyle = '#FFFFFF';
        const rx = points[0].x + Math.random() * (points[16].x - points[0].x);
        ctx.fillRect(rx, scanY, 2, 2);
    }

    ctx.shadowBlur = 0;

    ctx.restore();
}

// --- FITUR BARU: RETINAL SCAN ANIMATION ---
function drawRetinalScan(ctx, landmarks, color) {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    const drawEye = (points) => {
        // Hitung titik tengah mata
        let x = 0, y = 0;
        points.forEach(p => { x += p.x; y += p.y; });
        x /= points.length;
        y /= points.length;
        
        const time = Date.now() / 200;
        const radius = 6; // Ukuran pupil scan
        const arcLen = Math.PI * 2 * ((Math.sin(time * 0.5) + 1) / 2 * 0.8 + 0.2); // Arc tumbuh/menyusut
        
        ctx.save();
        ctx.translate(x, y);
        
        // Scanning Circle (Berputar)
        ctx.rotate(time);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, arcLen); // Lingkaran tidak penuh (loading effect)
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 5]); // Garis putus-putus
        ctx.stroke();
        ctx.restore();
    };
    
    drawEye(leftEye);
    drawEye(rightEye);
}

// --- FITUR BARU: COMPLEX SCI-FI HUD ---
function drawSciFiHUD(ctx, x, y, w, h, color) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const radius = Math.max(w, h) * 0.65;
    const time = Date.now() / 1000;

    ctx.save();
    ctx.translate(cx, cy);

    // 1. Outer Rotating Ring (Dashed)
    ctx.save();
    ctx.rotate(time * 0.4);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 20, 5, 20]); 
    ctx.stroke();
    ctx.restore();

    // 2. Inner Counter-Rotating Ring (Tech)
    ctx.save();
    ctx.rotate(-time * 0.6);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.85, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    ctx.stroke();
    ctx.restore();

    // 3. Radar Sweep Effect (NEW)
    ctx.save();
    ctx.rotate(time * 3); // Fast rotation
    const gradient = ctx.createConicGradient(0, 0, 0);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
    gradient.addColorStop(0.8, 'rgba(0, 255, 255, 0)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0.2)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
    ctx.fill();
    // Leading edge line
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(radius * 0.8, 0);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 5. Rotating Triangle (New Sophistication)
    ctx.save();
    ctx.rotate(time * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.9);
    ctx.lineTo(radius * 0.1, -radius * 0.8);
    ctx.lineTo(-radius * 0.1, -radius * 0.8);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    // 5. Rotating Triangle (New Sophistication)
    ctx.save();
    ctx.rotate(time * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.9);
    ctx.lineTo(radius * 0.1, -radius * 0.8);
    ctx.lineTo(-radius * 0.1, -radius * 0.8);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    ctx.restore();

    // 4. Tactical Corners (Animated Expansion)
    const expansion = Math.sin(time * 5) * 3;
    const cornerSize = 25;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 5;
    
    // Top Left
    ctx.beginPath(); ctx.moveTo(x - expansion, y + cornerSize - expansion); ctx.lineTo(x - expansion, y - expansion); ctx.lineTo(x + cornerSize - expansion, y - expansion); ctx.stroke();
    // Top Right
    ctx.beginPath(); ctx.moveTo(x + w + expansion - cornerSize, y - expansion); ctx.lineTo(x + w + expansion, y - expansion); ctx.lineTo(x + w + expansion, y + cornerSize - expansion); ctx.stroke();
    // Bottom Right
    ctx.beginPath(); ctx.moveTo(x + w + expansion, y + h + expansion - cornerSize); ctx.lineTo(x + w + expansion, y + h + expansion); ctx.lineTo(x + w + expansion - cornerSize, y + h + expansion); ctx.stroke();
    // Bottom Left
    ctx.beginPath(); ctx.moveTo(x - expansion + cornerSize, y + h + expansion); ctx.lineTo(x - expansion, y + h + expansion); ctx.lineTo(x - expansion, y + h + expansion - cornerSize); ctx.stroke();
    
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

// --- FITUR BARU: DATA WATERFALL (MATRIX RAIN MINI) ---
function drawDataWaterfall(ctx, x, y, height, color) {
    const chars = "01XYZ789";
    const fontSize = 10;
    const columns = 3;
    
    ctx.font = `${fontSize}px monospace`;
    ctx.fillStyle = color;
    
    for(let c = 0; c < columns; c++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const yPos = y + (Date.now() / (20 + c*5) % height); // Gerakan turun
        ctx.fillText(char, x + (c * 12), yPos);
    }
}

// --- FITUR BARU: BIOMETRIC CONNECTORS (Visualisasi Analisis Wajah) ---
function drawBiometricConnectors(ctx, box, landmarks, color) {
    const points = [
        landmarks.getLeftEye()[0],
        landmarks.getRightEye()[3],
        landmarks.getNose()[3],
        landmarks.getMouth()[0],
        landmarks.getMouth()[6]
    ];

    const time = Date.now() / 1000;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    
    points.forEach((pt, i) => {
        // Gambar Titik Data
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fill();

        // Gambar Garis Sirkuit ke Tepi Box
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        
        // Buat jalur siku-siku (Circuit Style)
        const direction = i % 2 === 0 ? 1 : -1;
        const elbowX = pt.x + (direction * (15 + Math.random() * 10));
        
        ctx.lineTo(elbowX, pt.y);
        ctx.lineTo(elbowX, box.y - 10); // Tarik ke atas box
        
        // EFEK BARU: Animasi aliran data (Dash Offset)
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -time * 50;
        
        ctx.stroke();
    });
    ctx.restore();
}

// --- FITUR BARU: AUGMENTED REALITY DATA POINTS ---
function drawARDataPoints(ctx, box, color) {
    const x = box.x;
    const y = box.y;
    const w = box.width;
    const h = box.height;
    const time = Date.now();

    ctx.save();
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7 + 0.2 * Math.sin(time / 200); // Efek alpha berdenyut

    // Data points dengan nilai acak untuk efek visual
    const data = [
        { label: 'TEMP', value: (36.5 + Math.random() * 0.5).toFixed(1) + '°C', pos: [x + w + 5, y + 10] },
        { label: 'PULSE', value: (70 + Math.floor(Math.random() * 5)) + ' BPM', pos: [x + w + 5, y + h - 5] },
        { label: 'RESP', value: (16 + Math.floor(Math.random() * 3)) + ' RPM', pos: [x - 5, y + 10], align: 'right' },
        { label: 'SIG', value: 'STABLE', pos: [x - 5, y + h - 5], align: 'right' }
    ];

    data.forEach(d => {
        ctx.textAlign = d.align || 'left';
        ctx.fillText(`[${d.label}: ${d.value}]`, d.pos[0], d.pos[1]);
    });

    ctx.restore();
}

// --- FITUR BARU: LIVE CONFIDENCE GRAPH ---
function drawLiveGraph(ctx, x, y, width, height, data, color) {
    if (data.length < 2) return;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(x, y + height/2); ctx.lineTo(x + width, y + height/2);
    ctx.stroke();

    // Data Line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    const step = width / (data.length - 1);
    data.forEach((val, i) => {
        const px = x + (i * step);
        const py = y + height - ((val / 100) * height);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
}

// --- FITUR BARU: HOLOGRAPHIC DATA STREAM (Koneksi Wajah ke Panel Kiri) ---
function drawDataStream(ctx, box, color) {
    const startX = box.x;
    const startY = box.y + (box.height / 2);
    const endX = 0; // Ujung kiri canvas (menuju panel data)
    const endY = startY + 100; // Sedikit melengkung ke bawah

    const time = Date.now() / 1000;
    
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    // Kurva Bezier untuk efek kabel data organik
    ctx.bezierCurveTo(startX - 100, startY, 100, endY, endX, endY);
    
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 15]); // Garis putus-putus
    ctx.lineDashOffset = -time * 150; // Animasi mengalir cepat ke kiri
    ctx.stroke();
    
    // Efek Kilatan Data (Packet)
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.restore();
}

// --- FITUR BARU: DIGITAL FACE PARTICLES ---
function drawDigitalParticles(ctx, box, color) {
    // 1. Emitter: Tambah partikel baru di sekitar wajah
    // Emit lebih banyak jika box besar
    const emitCount = 3; 
    for(let i=0; i<emitCount; i++) {
        faceParticles.push({
            x: box.x + Math.random() * box.width,
            y: box.y + Math.random() * box.height,
            vx: (Math.random() - 0.5) * 4, // Kecepatan X acak
            vy: (Math.random() - 1) * 4 - 2, // Cenderung ke atas (menguap)
            life: 1.0,
            size: Math.random() * 8 + 8,
            text: Math.random() > 0.5 ? '1' : '0' // Binary Digits
        });
    }

    // 2. Update & Render
    ctx.save();
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = color;
    
    for (let i = faceParticles.length - 1; i >= 0; i--) {
        let p = faceParticles[i];
        
        // Physics
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05; // Kecepatan pudar
        
        // Render
        if (p.life <= 0) {
            faceParticles.splice(i, 1);
        } else {
            ctx.globalAlpha = p.life;
            ctx.fillText(p.text, p.x, p.y);
        }
    }
    ctx.restore();
}

// --- VISUAL FX: SCREEN FLASH ---
function triggerScreenFlash(color) {
    const flash = document.getElementById('screenFlash');
    if (flash) {
        flash.style.backgroundColor = color;
        flash.style.opacity = 0.4;
        setTimeout(() => flash.style.opacity = 0, 100);
    }
}

// --- VISUAL FX: PARTICLE BURST (3D EXPLOSION) ---
function createParticleBurst(x, y, color) {
    // 1. Container untuk perspektif 3D
    const container = document.createElement('div');
    container.style.cssText = `position:fixed; left:${x}px; top:${y}px; width:0; height:0; pointer-events:none; z-index:9999; perspective: 800px;`;
    document.body.appendChild(container);

    // 2. Shockwave Ring
    const ring = document.createElement('div');
    ring.style.cssText = `
        position: absolute; left: -50px; top: -50px; width: 100px; height: 100px;
        border: 4px solid ${color}; border-radius: 50%; opacity: 1;
        transform: translateZ(0) scale(0);
    `;
    container.appendChild(ring);
    const ringAnim = ring.animate([
        { transform: 'translateZ(0) scale(0)', opacity: 1, borderWidth: '10px' },
        { transform: 'translateZ(50px) scale(5)', opacity: 0, borderWidth: '0px' }
    ], { duration: 800, easing: 'ease-out' });
    ringAnim.onfinish = () => ring.remove();

    // 3. 3D Particles
    const particleCount = 40;
    for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('div');
        const size = Math.random() * 8 + 4;
        const isSquare = Math.random() > 0.5;
        
        p.style.cssText = `
            position: absolute; left: 0; top: 0;
            width: ${size}px; height: ${size}px;
            background: ${color};
            box-shadow: 0 0 ${size}px ${color};
            border-radius: ${isSquare ? '0%' : '50%'};
            transform-style: preserve-3d;
        `;
        container.appendChild(p);

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const velocity = Math.random() * 300 + 100;
        
        const tx = velocity * Math.sin(phi) * Math.cos(theta);
        const ty = velocity * Math.sin(phi) * Math.sin(theta);
        const tz = velocity * Math.cos(phi);
        const rotX = Math.random() * 720;
        const rotY = Math.random() * 720;

        const anim = p.animate([
            { transform: 'translate3d(0,0,0) rotateX(0deg) rotateY(0deg) scale(1)', opacity: 1 },
            { transform: `translate3d(${tx}px, ${ty}px, ${tz}px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(0)`, opacity: 0 }
        ], { 
            duration: 1000 + Math.random() * 500, 
            easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)' 
        });
        anim.onfinish = () => p.remove();
    }
    
    setTimeout(() => container.remove(), 2000);
}

// --- HELPER: TEXT DECRYPTION EFFECT ---
function resolveText(target, frame, totalFrames) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&";
    let output = "";
    const progress = frame / totalFrames;
    for (let i = 0; i < target.length; i++) {
        if (i / target.length < progress) {
            output += target[i];
        } else {
            output += chars[Math.floor(Math.random() * chars.length)];
        }
    }
    return output;
}

// --- HELPER: TYPEWRITER EFFECT ---
function animateText(element, text, speed = 30) {
    if (!element) return;
    element.textContent = '';
    let i = 0;
    
    // Hentikan interval lama jika ada (mencegah tumpuk)
    if (element.dataset.typingInterval) clearInterval(element.dataset.typingInterval);
    
    const interval = setInterval(() => {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            // Efek suara tik data (NEW)
            if (i % 2 === 0) SoundFX.play('type'); 
        } else {
            clearInterval(interval);
            element.dataset.typingInterval = null;
        }
    }, speed);
    
    element.dataset.typingInterval = interval;
}

// --- HELPER: BOOT SEQUENCE ---
async function runBootSequence() {
    const bootScreen = document.getElementById('boot-screen');
    const bootLog = document.getElementById('boot-log');
    if (!bootScreen || !bootLog) return;

    const lines = [
        "INITIALIZING BIOMETRIC KERNEL v4.2...",
        "LOADING NEURAL MODULES [TINY_FACE_DETECTOR]... OK",
        "LOADING NEURAL MODULES [LANDMARK_68_NET]... OK",
        "LOADING NEURAL MODULES [RECOGNITION_NET]... OK",
        "MOUNTING SECURE DATABASE CONNECTION...",
        "CALIBRATING OPTICAL SENSORS...",
        "ESTABLISHING CAMERA FEED...",
        "SYSTEM READY. WELCOME ADMIN."
    ];
    
    // Voice Greeting
    setTimeout(() => SoundFX.speak("System Online. Optical Sensors Calibrated."), 1000);

    for (const line of lines) {
        const p = document.createElement('div');
        p.className = 'boot-line';
        p.innerHTML = `> ${line}`;
        bootLog.appendChild(p);
        await new Promise(r => setTimeout(r, Math.random() * 200 + 100)); // Random delay
    }

    await new Promise(r => setTimeout(r, 600));
    bootScreen.style.transition = "opacity 0.8s ease-out";
    bootScreen.style.opacity = "0";
    setTimeout(() => bootScreen.remove(), 800);
}

// --- NEW FEATURE: SMART HUD LABEL ---
function drawSmartHUD(ctx, box, label, color, confidence, emotion = 'ANALYZING') {
    const padding = 10;
    const tagX = box.x + box.width + 30; // Posisi di kanan wajah
    const tagY = box.y;
    const hudWidth = 180;
    const hudHeight = 70;

    // 1. Garis Penghubung (Connector Line)
    ctx.beginPath();
    ctx.moveTo(box.x + box.width, box.y + (box.height * 0.2)); // Dari sisi kanan bracket
    ctx.lineTo(tagX - 10, box.y + (box.height * 0.2)); // Horizontal
    ctx.lineTo(tagX, tagY); // Miring ke sudut HUD
    ctx.lineTo(tagX + hudWidth, tagY); // Garis atas HUD
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Background Panel HUD
    ctx.fillStyle = 'rgba(5, 15, 20, 0.85)';
    ctx.fillRect(tagX, tagY, hudWidth, hudHeight);
    
    // 3. Border Kiri HUD (Aksen Warna Status)
    ctx.fillStyle = color;
    ctx.fillRect(tagX, tagY, 4, hudHeight);

    // 4. Teks Informasi
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Rajdhani", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label.length > 15 ? label.substring(0, 15) + '...' : label, tagX + 15, tagY + 25);

    // 5. Sub-info (ID & Confidence)
    ctx.fillStyle = '#00FFFF';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText(`ID-SIG: ${Math.floor(Math.random() * 99999)}`, tagX + 15, tagY + 45);

    // 6. Confidence Bar Mini
    const confVal = Math.min(100, Math.max(0, confidence));
    ctx.fillStyle = '#333';
    ctx.fillRect(tagX + 15, tagY + 55, 100, 4); // Track
    ctx.fillStyle = confVal > 70 ? '#00FF7F' : (confVal > 40 ? '#FFD700' : '#FF0055');
    ctx.fillRect(tagX + 15, tagY + 55, confVal, 4); // Fill
    
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(`${confVal.toFixed(0)}%`, tagX + 125, tagY + 60);

    // 7. Emotion Readout (NEW)
    ctx.fillStyle = '#00FFFF';
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText(`PSYCHE: ${emotion.toUpperCase()}`, tagX + 15, tagY + 75);
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
    newLog.style.opacity = '0';
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
        faceapi.matchDimensions(canvas, { width: W, height: videoH});
        logSystem(`Canvas resized to ${W}x${videoH}.`, 'text-cyan-500');
    }
}

window.addEventListener('resize', resizeCanvas);


function updateSystemDiagnostics(confidence) {
    // Confidence Bar Only
    if(matchThresholdBar) {
        const confPercent = Math.min(100, confidence);
        matchThresholdBar.style.width = `${confPercent}%`;
        
        if (confPercent >= 70) {}
    }
}

function logAttendance(name, time) {
    if (!attendanceLog) return;
    
    // Hapus placeholder jika ada
    const placeholder = attendanceLog.querySelector('.italic');
    if (placeholder) placeholder.remove();

    const entry = document.createElement('div');
    entry.className = 'flex justify-between items-center border-b border-cyan-900/30 pb-1 mb-1 animate-[fadeIn_0.5s_ease-out]';
    entry.innerHTML = `
        <span class="text-cyan-400 font-bold truncate w-2/3 flex items-center gap-2">
            <span class="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_#00FF00]"></span>
            ${name}
        </span>
        <span class="text-gray-400 text-[10px] font-mono">${time}</span>
    `;
    
    attendanceLog.prepend(entry);
    
    // Batasi log agar tidak terlalu panjang
    if (attendanceLog.children.length > 50) {
        attendanceLog.removeChild(attendanceLog.lastChild);
    }
}

// Panggil update HUD pada interval
function updateClock() {
    const now = new Date();
    
    // FIX: Definisi variabel animasi warna dan waktu UTC yang hilang
    const time = Date.now();
    const hue = (time / 20) % 360;
    const hue1 = hue;
    const hue2 = (hue + 60) % 360;
    const utcH = String(now.getUTCHours()).padStart(2, '0');
    const utcM = String(now.getUTCMinutes()).padStart(2, '0');
    
    // Update Jam, Menit, Detik
    if (clockH) clockH.textContent = String(now.getHours()).padStart(2, '0');
    if (clockM) clockM.textContent = String(now.getMinutes()).padStart(2, '0');
    if (clockS) clockS.textContent = String(now.getSeconds()).padStart(2, '0');
    
    // Update Milidetik (High Precision & Nanosecond Simulation)
    if (clockMs) {
        const ms = String(now.getMilliseconds()).padStart(3, '0');
        // Simulasi Nanosecond (3 digit random)
        const ns = String(Math.floor(Math.random() * 999)).padStart(3, '0');
        
        clockMs.innerHTML = `
            <span style="color:hsl(${hue}, 100%, 75%); text-shadow:0 0 8px hsl(${hue}, 100%, 50%);">${ms}</span>
            <span style="font-size:0.5em; color:#666; vertical-align:top; margin-left:1px;">.${ns}</span>
        `;
    }
    
    if (clockDate) {
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        // Hitung Day of Year (DOY)
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now - start;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);
        
        // Hex Timestamp (Last 6 chars)
        const hexStamp = Math.floor(now.getTime() / 1000).toString(16).toUpperCase().slice(-6);
        
        // Binary Seconds Visualization (6 bits)
        const sec = now.getSeconds();
        let binVis = '';
        for(let i=5; i>=0; i--) {
            const bit = (sec >> i) & 1;
            binVis += `<span style="display:inline-block; width:6px; height:6px; margin:0 1px; background-color:${bit ? '#00FF7F' : '#333'}; box-shadow:${bit ? '0 0 4px #00FF7F' : 'none'}; border-radius:50%;"></span>`;
        }

        clockDate.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:2px; line-height:1.1;">
                <div style="font-size:0.9em; letter-spacing:1px;">
                    <span style="color:#00FFFF; text-shadow:0 0 5px rgba(0,255,255,0.5);">${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}</span>
                    <span style="color:#444; margin:0 5px;">|</span>
                    <span style="color:#FFD700;">DOY.${String(dayOfYear).padStart(3, '0')}</span>
                    <span style="color:#444; margin:0 5px;">|</span>
                    <span style="color:#00FF7F;">${days[now.getDay()]}</span>
                </div>
                <div style="font-size:0.75em; display:flex; align-items:center; gap:8px; opacity:0.9;">
                    <span style="color:#AAA;">ZULU: ${utcH}:${utcM}</span>
                    <span style="color:#444;">//</span>
                    <span style="color:#FF0055; font-family:'Courier New';">0x${hexStamp}</span>
                    <span style="color:#444;">//</span>
                    <div style="display:flex; align-items:center;">${binVis}</div>
                </div>
            </div>
        `;
    }

    if (clockBar) {
        // Progress bar detik dengan efek gradient flow
        const totalMs = (now.getSeconds() * 1000) + now.getMilliseconds();
        const percent = (totalMs / 60000) * 100;
        clockBar.style.width = `${percent}%`;
        
        clockBar.style.background = `linear-gradient(90deg, hsl(${hue1}, 100%, 50%), hsl(${hue2}, 100%, 50%))`;
        clockBar.style.boxShadow = `0 0 15px hsl(${hue1}, 100%, 60%)`;
    }
    
    requestAnimationFrame(updateClock);
}

function animateTitle() {
    if (!mainTitle) return;
    const targetText = AGENCY_NAME;
    
    // --- TAMBAHAN: SIGER LAMPUNG GOLD (Inject Otomatis) ---
    if (!document.getElementById('siger-header-icon') && mainTitle && mainTitle.parentNode) {
        const sigerContainer = document.createElement('div');
        sigerContainer.id = 'siger-header-icon';
        sigerContainer.style.display = 'flex';
        sigerContainer.style.justifyContent = 'center';
        sigerContainer.style.alignItems = 'center';
        sigerContainer.style.width = '100%';
        sigerContainer.style.marginBottom = '-5px'; // Rapat dengan teks
        
        // SVG Siger Stilasi (Gold Gradient) + Logo Kiri Kanan
        sigerContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 20px;">
            <svg width="240" height="90" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.8));">
                <defs>
                    <linearGradient id="gradGold" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF8DC"/><stop offset="40%" stop-color="#FFD700"/><stop offset="100%" stop-color="#DAA520"/></linearGradient>
                    <linearGradient id="gradShimmer" x1="0%" y1="0%" x2="100%" y2="0%" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
                        <stop offset="50%" stop-color="rgba(255,255,255,0.9)"/>
                        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
                        <animate attributeName="x1" from="-200" to="400" dur="2.5s" repeatCount="indefinite" />
                        <animate attributeName="x2" from="-100" to="500" dur="2.5s" repeatCount="indefinite" />
                    </linearGradient>
                </defs>
                <path d="M10,90 L190,90 L185,70 Q170,85 160,50 Q150,75 140,40 Q130,70 120,30 Q110,60 100,10 Q90,60 80,30 Q70,70 60,40 Q50,75 40,50 Q30,85 15,70 Z" 
                      fill="url(#gradGold)" stroke="#B8860B" stroke-width="2" stroke-linejoin="round" />
                <path d="M10,90 L190,90 L185,70 Q170,85 160,50 Q150,75 140,40 Q130,70 120,30 Q110,60 100,10 Q90,60 80,30 Q70,70 60,40 Q50,75 40,50 Q30,85 15,70 Z" 
                      fill="url(#gradShimmer)" style="mix-blend-mode: overlay;" pointer-events="none"/>
                <circle cx="100" cy="80" r="4" fill="#FFF" opacity="0.9"/>
            </svg>
        </div>
        <style>
            @keyframes floatLogo {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-8px); }
            }
        </style>`;
        
        mainTitle.parentNode.insertBefore(sigerContainer, mainTitle);
    }
    
    // Setup awal: Buat span jika belum sesuai (Hanya sekali)
    if (mainTitle.children.length !== targetText.length) {
        mainTitle.innerHTML = '';
        mainTitle.style.opacity = '1';
        mainTitle.style.display = 'inline-flex';
        mainTitle.style.justifyContent = 'center';
        mainTitle.style.gap = '4px'; 
        mainTitle.style.perspective = '1000px'; // Efek 3D
        
        // GAYA HURUF BARU: Lebih tebal, solid, dan futuristik
        mainTitle.style.fontFamily = '"Rajdhani", "Orbitron", "Arial Black", sans-serif';
        mainTitle.style.fontWeight = '900';
        mainTitle.style.fontSize = 'clamp(2rem, 4vw, 3.5rem)'; // Responsif Besar
        mainTitle.style.letterSpacing = '6px';
        mainTitle.style.textTransform = 'uppercase';
        // Hapus filter drop-shadow container agar tidak tumpang tindih
        mainTitle.style.filter = 'drop-shadow(0 0 15px rgba(0,255,255,0.15))'; 

        for (let i = 0; i < targetText.length; i++) {
            const span = document.createElement('span');
            span.style.display = 'inline-block';
            span.style.minWidth = '0.6em';
            span.style.textAlign = 'center';
            span.dataset.original = targetText[i]; // Simpan huruf asli
            
            if (targetText[i] === ' ') {
                span.innerHTML = '&nbsp;';
                span.style.minWidth = '0.5em';
            } else {
                span.textContent = targetText[i];
            }
            
            // Style dasar span
            span.style.color = '#00FFFF'; 
            span.style.textShadow = '0 0 10px rgba(0, 255, 255, 0.5)';
            span.style.transition = 'transform 0.1s, color 0.1s, text-shadow 0.1s';
            span.style.transformStyle = 'preserve-3d';
            
            mainTitle.appendChild(span);
        }
    }

    let tick = 0;
    
    // Clear interval jika ada (disimpan di properti elemen untuk mencegah tumpuk)
    if (mainTitle.animationInterval) clearInterval(mainTitle.animationInterval);

    // Loop animasi: Efek "Quantum Glitch & Neon Flow"
    mainTitle.animationInterval = setInterval(() => {
        tick++;
        const spans = mainTitle.children;
        const time = Date.now() / 1000;
        
        // Gelombang Cahaya Bergerak
        const wavePos = (time * 2.5) % (spans.length + 6) - 3;

        for (let i = 0; i < spans.length; i++) {
            const span = spans[i];
            const original = span.dataset.original;
            
            if (original === ' ') continue;

            let char = original;
            let color = '#00FFFF'; // Base: Cyan Neon
            let textShadow = '0 0 8px rgba(0, 255, 255, 0.6)';
            let transform = 'scale(1) translateZ(0px)';
            let opacity = 0.8 + (Math.sin(time * 3 + i) * 0.1); // Breathing effect

            // Hitung jarak dari gelombang
            const dist = Math.abs(i - wavePos);

            // Efek Highlight (Passing Beam)
            if (dist < 1.5) {
                color = '#FFFFFF'; // White Hot
                textShadow = '0 0 20px #FFFFFF, 0 0 40px #00FFFF, 0 0 60px #0088FF';
                transform = 'scale(1.2) translateZ(20px)';
                opacity = '1';
            } else if (dist < 3) {
                color = '#0088FF'; // Blue Trail
                textShadow = '0 0 15px #0088FF';
                transform = 'scale(1.1) translateZ(10px)';
            }

            // Efek Glitch Acak (Digital Noise)
            if (Math.random() < 0.01) {
                const glitchChars = "X@#$%=+<>?01";
                char = glitchChars[Math.floor(Math.random() * glitchChars.length)];
                color = '#FF0055'; // Error Red
                textShadow = '2px 0 0 #00FFFF, -2px 0 0 #FF0055'; // Chromatic Aberration
                transform = `translate(${Math.random()*4-2}px, ${Math.random()*4-2}px)`;
                opacity = '1';
            }

            // Apply
            if (span.textContent !== char) span.textContent = char;
            span.style.color = color;
            span.style.textShadow = textShadow;
            span.style.transform = transform;
            span.style.opacity = opacity;
        }

        // --- EFEK PARTIKEL EMAS JATUH ---
        if (Math.random() < 0.3) { // Muncul acak (30% chance per tick)
            const particle = document.createElement('div');
            const size = Math.random() * 4 + 2;
            particle.style.cssText = `
                position: absolute; width: ${size}px; height: ${size}px;
                background: radial-gradient(circle, #FFF, #FFD700);
                border-radius: 50%; box-shadow: 0 0 8px #FFD700;
                pointer-events: none; z-index: 20; opacity: 0;
                left: 50%; top: 0px; margin-left: ${Math.random() * 400 - 200}px;
            `;
            
            if (mainTitle.parentNode) {
                if (getComputedStyle(mainTitle.parentNode).position === 'static') mainTitle.parentNode.style.position = 'relative';
                mainTitle.parentNode.appendChild(particle);
                
                const anim = particle.animate([
                    { transform: 'translateY(0) scale(0)', opacity: 0 },
                    { transform: `translateY(${Math.random() * 20 + 20}px) scale(1)`, opacity: 1, offset: 0.2 },
                    { transform: `translateY(${Math.random() * 100 + 100}px) scale(0)`, opacity: 0 }
                ], { duration: 2000 + Math.random() * 1000, easing: 'linear' });
                
                anim.onfinish = () => particle.remove();
            }
        }
    }, 50); 
}

updateClock(); // Start loop animasi jam (requestAnimationFrame)

// --- NEW: PERSONNEL ROSTER ---
let rosterScrollInterval = null; // Variabel kontrol animasi scroll

function populatePersonnelRoster() {
    if (!personnelRoster || Object.keys(employeeMap).length === 0) {
        if(personnelRoster) personnelRoster.innerHTML = '<div class="text-gray-500 text-xs italic text-center py-4">No personnel data found in database.</div>';
        return;
    }

    // Reset & Stop animasi lama
    if (rosterScrollInterval) cancelAnimationFrame(rosterScrollInterval);
    personnelRoster.innerHTML = ''; 
    personnelRoster.style.overflow = 'hidden'; // Sembunyikan scrollbar native
    personnelRoster.style.position = 'relative';

    // Wrapper untuk konten
    const contentWrapper = document.createElement('div');
    contentWrapper.style.width = '100%';

    // Ambil data dari employeeMap, urutkan berdasarkan nama
    const sortedEmployees = Object.values(employeeMap).sort((a, b) => a.nama.localeCompare(b.nama));

    // Helper buat baris
    const createRow = (emp) => {
        const item = document.createElement('div');
        item.className = 'flex items-center gap-4 p-2.5 border-b border-cyan-500/30 hover:bg-cyan-500/20 transition-colors duration-200 cursor-pointer';
        item.dataset.name = emp.nama.toLowerCase(); // Simpan nama untuk search

        item.innerHTML = `
            <img src="data:image/jpeg;base64,${emp.foto}" class="w-10 h-10 rounded-full object-cover border border-cyan-400/60 shadow-[0_0_5px_rgba(0,255,255,0.4)] flex-shrink-0 bg-gray-900">
            <div class="flex-grow overflow-hidden">
                <p class="font-bold text-sm text-white tracking-wide truncate drop-shadow-md leading-tight" title="${emp.nama}">${emp.nama}</p>
                <p class="text-[11px] text-cyan-200/80 truncate font-mono mt-0.5" title="${emp.jabatan}">${emp.jabatan}</p>
            </div>
            <div class="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_5px_#00FF00] flex-shrink-0 animate-pulse" title="Registered & Online"></div>
        `;
        return item;
    };

    // 1. Masukkan data asli
    sortedEmployees.forEach(emp => contentWrapper.appendChild(createRow(emp)));
    personnelRoster.appendChild(contentWrapper);

    // 2. Cek apakah perlu scroll (Konten lebih tinggi dari container)
    if (contentWrapper.offsetHeight > personnelRoster.clientHeight) {
        // Duplikasi konten untuk efek looping seamless
        sortedEmployees.forEach(emp => contentWrapper.appendChild(createRow(emp)));
        
        let scrollPos = 0;
        const speed = 0.5; // Kecepatan scroll (pixel per frame)

        const animateScroll = () => {
            scrollPos += speed;
            // Reset jika sudah mencapai setengah (akhir data asli)
            if (scrollPos >= contentWrapper.scrollHeight / 2) {
                scrollPos = 0;
            }
            personnelRoster.scrollTop = scrollPos;
            rosterScrollInterval = requestAnimationFrame(animateScroll);
        };

        animateScroll();

        // Pause saat mouse hover agar user bisa klik/baca
        personnelRoster.addEventListener('mouseenter', () => cancelAnimationFrame(rosterScrollInterval));
        personnelRoster.addEventListener('mouseleave', () => animateScroll());
    }
}


const api = {
    getDescriptors: async () => {
        // Safety check: Jangan fetch jika dibuka via file:// (Local)
        if (window.location.protocol === 'file:') {
            throw new Error("Local File Mode (No Backend)");
        }

        try {
            const response = await fetch('/api/karyawan/descriptors');
            if (!response.ok) {
                if (response.status === 404) throw new Error("API Not Found (404). Backend missing?");
                throw new Error(`Server Error: ${response.status} ${response.statusText}`);
            }
            
            // FIX: Baca sebagai text dulu untuk debugging jika server mengirim HTML error (bukan JSON)
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                if (!data.success) throw new Error(data.message || 'API returned failure.');
                return data.descriptors;
            } catch (e) {
                console.error("RAW SERVER RESPONSE (Bukan JSON):", text);
                // console.error("RAW SERVER RESPONSE (Bukan JSON):", text); // Suppress noise
                throw new Error(`Invalid JSON received. Cek Console (F12) untuk melihat respons server.`);
            }
        } catch (error) {
            console.error('Error loading descriptors:', error);
            // console.error('Error loading descriptors:', error); // Suppress duplicate logging
            throw error; // Lemparkan error agar bisa ditangkap oleh pemanggil
        }
    },
    postAttendance: async (karyawanId) => {
        const response = await fetch('/api/absensi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_karyawan: karyawanId })
        });
        if (!response.ok) throw new Error(`Server returned an error status (${response.status}).`);
        return await response.json();
    },
    getTodayAttendance: async () => {
        if (window.location.protocol === 'file:') return [];
        try {
            // Mengambil data absensi hari ini untuk Kernel Diagnostic
            const response = await fetch('/api/absensi/today');
            if (!response.ok) return [];
            const res = await response.json();
            return Array.isArray(res) ? res : (res.data || []);
        } catch (e) {
            console.warn("Gagal mengambil data absensi hari ini:", e);
            // console.warn("Gagal mengambil data absensi hari ini:", e); // Silent fail
            return [];
        }
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
        // console.log("DEBUG SERVER DATA:", descriptorsData);
        logSystem(`DIAGNOSTIK: Diterima ${descriptorsData ? descriptorsData.length : 0} data dari server.`, 'text-cyan-400');
        
        if (!descriptorsData || descriptorsData.length === 0) {
            setStatusVisual(`⚠️ DB KOSONG. Mode Deteksi Saja.`, 'text-amber-500');
            if(dbStatus) {
                dbStatus.textContent = 'EMPTY';
                dbStatus.className = 'text-amber-500 font-bold';
            }
            logSystem(`Database loaded: 0 records.`, 'text-amber-500');
            return [];
        }

        const descriptors = descriptorsData.map(item => {
            const descriptorArray = typeof item.face_descriptor === 'string' 
                ? JSON.parse(item.face_descriptor) 
                : item.face_descriptor;
            employeeMap[item.id_karyawan] = {
                nama: item.nama,
                jabatan: item.jabatan || 'N/A',
                foto: item.foto // Simpan foto base64
            };
            return new faceapi.LabeledFaceDescriptors(item.id_karyawan, [new Float32Array(descriptorArray)]);
        });

        
        // --- PANGGIL FUNGSI BARU SETELAH employeeMap SIAP ---
        populatePersonnelRoster();

        setStatusVisual(`${descriptors.length} ID Karyawan dimuat. SYSTEM READY.`, 'text-green-500');
        if(dbStatus) {
            dbStatus.textContent = 'ONLINE';
            dbStatus.className = 'text-green-500 font-bold';
        }
        logSystem(`Database loaded: ${descriptors.length} records.`, 'text-green-500');
        return descriptors;

    } catch (error) {
        console.error('Error loading descriptors:', error);
        // console.error('Error loading descriptors:', error); // Suppress stack trace
        console.warn(`[DB SYNC] Connection failed: ${error.message}`);
        logSystem(`DIAGNOSTIK ERROR: ${error.message}`, 'text-red-500');
        
        // FIX: Jika server merespon error "Database is empty", anggap sebagai KOSONG (Amber), bukan OFFLINE (Merah)
        if (error.message && (error.message.includes('empty') || error.message.includes('Database is empty'))) {
            setStatusVisual(`⚠️ DB KOSONG. Mode Deteksi Saja.`, 'text-amber-500');
            if(dbStatus) {
                dbStatus.textContent = 'EMPTY';
                dbStatus.className = 'text-amber-500 font-bold';
            }
            logSystem(`Database loaded: 0 records (Server Message).`, 'text-amber-500');
            return [];
        }

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
        const cameraWidget = cameraSelect.closest('.widget-panel');
        if (videoDevices.length > 1 && cameraWidget) { 
            cameraWidget.style.display = 'flex'; 
        } else if (cameraWidget) {
             cameraWidget.style.display = 'none';
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
    isDetectionActive = false; // Hentikan loop deteksi
}

async function startCamera(deviceId = null) {
    stopCamera(); 
    
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
        
        logSystem(`Camera Stream Established.`, 'text-green-500');

        await new Promise(resolve => video.onloadedmetadata = resolve);
        video.play();
        resizeCanvas(); 
    } catch (err) {
        setStatusVisual(`❌ Gagal Start Kamera: Pastikan Izin Diberikan.`, 'text-red-500');
        logSystem(`FATAL: Camera failure. ${err.message}.`, 'text-red-500');
    }
}

async function switchCamera(deviceId) {
    setStatusVisual('SWITCHING CAMERA...', 'text-cyan-500', true);
    logSystem(`Switching to camera ID: ${deviceId.substring(0, 8)}...`, 'text-amber-500');
    await startCamera(deviceId);
}

async function loadTodayAttendance() {
    if (!attendanceLog) return;
    try {
        const data = await api.getTodayAttendance();
        if (data && data.length > 0) {
            logSystem(`KERNEL DIAGNOSTIC: Loading ${data.length} records...`, 'text-cyan-500');
            // Loop data (Asumsi urut waktu ASC dari server)
            // logAttendance melakukan prepend, jadi data terakhir akan muncul paling atas
            data.forEach(row => {
                const nama = row.nama || row.name || 'Karyawan';
                let jam = row.jam || row.waktu || row.created_at || '';
                // Format jam jika berupa datetime panjang
                if (jam.length > 8 || jam.includes('T')) {
                    jam = new Date(jam).toLocaleTimeString('id-ID', { hour12: false });
                }
                logAttendance(nama, jam);
            });
        }
    } catch (e) {
        console.error("Error loading today attendance:", e);
    }
}

async function initializeApp() {
    setStatusVisual('BOOT SEQUENCE: Loading Neural Engine...', 'text-cyan-500', true);
    logSystem('Application boot sequence initiated.', 'text-cyan-500');

    try {
        // Memuat Model Face-API.js
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
            faceapi.nets.faceExpressionNet.loadFromUri('./models') // NEW: Load Emotion Model
        ]);
        
        logSystem('Neural Network Models Loaded.', 'text-green-500');
        setStatusVisual('Models Loaded. Starting Camera Stream...', 'text-cyan-400', true);

        await getCameraDevices(); 
        const initialDeviceId = cameraSelect ? cameraSelect.value : null;
        await startCamera(initialDeviceId); 

        // Load data absensi hari ini ke panel Diagnostic/Log
        loadTodayAttendance();

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

    // FIX: Gunakan Recursive Timeout menggantikan setInterval untuk mencegah Memory Leak
    if (!isDetectionActive) {
        isDetectionActive = true;
        detectFaceLoop();
        setStatusVisual('SYSTEM READY. AWAITING TARGET...', 'text-gray-300', true);
        logSystem('Scanning Loop Activated.', 'text-green-500');
    }
});

async function detectFaceLoop() {
    if (!isDetectionActive) return;
    await detectFace();
    if (isDetectionActive) {
        setTimeout(detectFaceLoop, DETECTION_INTERVAL_MS);
    }
}

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
    if (video.paused || video.ended || !faceapi.nets.tinyFaceDetector.params || !labeledDescriptors) return;
    
    const displaySize = { width: canvas.width, height: canvas.height };

    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.80 }))
	.withFaceLandmarks()
    .withFaceExpressions() // NEW: Detect Expressions
        .withFaceDescriptor();

    if(!isProcessing) videoContainer.classList.remove('scan-success');

    if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const { box } = resizedDetections.detection;
        const { landmarks } = resizedDetections;

        // --- ANALISIS EMOSI (NEW) ---
        const expressions = resizedDetections.expressions;
        const sortedEmotions = Object.keys(expressions).sort((a, b) => expressions[b] - expressions[a]);
        const dominantEmotion = sortedEmotions[0] || 'NEUTRAL';

        // --- FITUR BARU: DIGITAL AUTO-ZOOM ---
        const scale = 1.8; // Faktor zoom, bisa disesuaikan
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        
        // Hitung translasi agar wajah tetap di tengah
        const translateX = (displaySize.width / 2) - centerX;
        const translateY = (displaySize.height / 2) - centerY;

        // Terapkan transformasi ke elemen video. Transisi dihandle oleh CSS.
        // Penting: scaleX(-1) harus tetap ada untuk efek cermin.
        video.style.transform = `scaleX(-1) scale(${scale}) translate(${translateX}px, ${translateY}px)`;

        // --- GAMBAR EFEK CANGGIH BARU ---
        // 1. Hexagonal Force Field di latar belakang wajah
        drawHexGridOverlay(context, box, '#00FFFF');
        
        // 2. Topographic Map (Garis Kontur)
        drawTopographicFeatures(context, landmarks, '#00FFFF');

        drawHolographicMesh(context, landmarks);
        
        // GAMBAR KONEKTOR BIOMETRIK (NEW)
        drawBiometricConnectors(context, box, landmarks, '#00FFFF');

        // GAMBAR RETINAL SCAN (NEW)
        drawRetinalScan(context, landmarks, '#00FFFF');

        // --- GAMBAR EFEK BARU ---
        // drawScanningBeam(context, box); // Diganti dengan HUD Sci-Fi
        drawSciFiHUD(context, box.x, box.y, box.width, box.height, '#00FFFF');
        
        const nose = landmarks.getNose()[3]; // Titik tengah hidung
        // drawTargetLock(context, nose.x, nose.y, box.width * 0.3); // Diganti Sci-Fi HUD
        
 	    // Efek suara scanning ringan (opsional, bisa dimatikan jika terlalu berisik)
        if (Math.random() > 0.85) SoundFX.play('scan'); 

        setStatusVisual('SUBJECT DETECTED. PROCESSING BIOMETRICS...', 'text-amber-500', true);
        setSystemTheme('SCANNING'); // Update Theme to Scanning (Blue/Cyan)

        let faceLabel = 'UNKNOWN';
        let faceColor = '#FF0055'; 
        let confidence = 0;

        if (labeledDescriptors && labeledDescriptors.length > 0) {
            const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, FACE_MATCHING_THRESHOLD);
            const bestMatch = faceMatcher.findBestMatch(detections.descriptor);

            const matchDistance = bestMatch.distance;
            const confidenceRaw = Math.max(0, FACE_MATCHING_THRESHOLD - matchDistance); 
            confidence = (confidenceRaw / FACE_MATCHING_THRESHOLD) * 100;
            
            // Update History Grafik
            confidenceHistory.push(confidence);
            if (confidenceHistory.length > 50) confidenceHistory.shift();
            
            updateSystemDiagnostics(confidence);

            if (bestMatch.label !== 'unknown' && matchDistance <= FACE_MATCHING_THRESHOLD) {
                const recognizedId = bestMatch.label;
                const employee = employeeMap[recognizedId] || { nama: `ID:${recognizedId}`, jabatan: 'N/A' };

                faceLabel = employee.nama;
                
                // --- LOGIKA DECRYPT TEXT ---
                if (faceLabel !== targetLabel) {
                    targetLabel = faceLabel;
                    decryptionFrame = 0;
                }
                if (decryptionFrame < 15) { // 15 frame untuk decrypt
                    decryptionFrame++;
                    faceLabel = resolveText(targetLabel, decryptionFrame, 15);
                }

                faceColor = '#00FF7F'; 

                // Hanya update jika ID berubah atau belum ada match sebelumnya
                if (!lastKnownMatch || lastKnownMatch.id !== recognizedId) {
                    // Ambil data lengkap dari employeeMap yang sudah dimuat di awal
                    const { nama, jabatan } = employee;
                    
                    // Update Foto dengan Efek Scan
                    if (userPhotoDisplay) {
                        userPhotoDisplay.src = `data:image/jpeg;base64,${employee.foto}`;
                        if (photoContainer) {
                            photoContainer.classList.remove('photo-scan-active');
                            void photoContainer.offsetWidth; // Trigger reflow
                            photoContainer.classList.add('photo-scan-active');
                        }
                    }
                    // Update Teks dengan Efek Mengetik
                    if (userIdDisplay) animateText(userIdDisplay, nama);
                    if (userJabatanDisplay) animateText(userJabatanDisplay, jabatan || 'N/A');
                }
                
                userStatusDisplay.textContent = 'VERIFYING...';
                userStatusDisplay.className = 'text-lg font-bold text-amber-500';

                // Update Panel Kiri dengan Emosi
                if(userEmotionDisplay) userEmotionDisplay.textContent = dominantEmotion.toUpperCase();
                
                if (!isProcessing) { 
                    setStatusVisual(`ID MATCH: ${employee.nama}. AUTHORIZING...`, 'text-cyan-400', true);
                    isProcessing = true;
                    // Simpan match terakhir sebelum proses absensi
                    lastKnownMatch = { id: recognizedId, box: resizedDetections.detection.box, landmarks: resizedDetections.landmarks, faceLabel: faceLabel, faceColor: faceColor };
 		    await processAttendance(recognizedId);
                }

            } else {
                resetTargetData();
                const potentialMatch = (bestMatch.label !== 'unknown') ? employeeMap[bestMatch.label] : null;
                const potentialName = potentialMatch ? potentialMatch.nama : 'Unknown';

                // Panggil nama jika ada kandidat, bahkan jika ditolak
                if (potentialMatch) {
                    setStatusVisual(`IDENTITY MISMATCH: ${potentialName}. ACCESS DENIED.`, 'text-red-500');
                    SoundFX.speak(`Access Denied, ${potentialName}`);
                } else {
                    setStatusVisual('WAJAH TIDAK DIKENAL...', 'text-red-500');
                    SoundFX.speak('ACCES DENIED');
                }
                
 		        userStatusDisplay.textContent = 'ACCESS DENIED';
                faceLabel = 'DENIED ACCESS';
                if(userEmotionDisplay) userEmotionDisplay.textContent = 'UNKNOWN';
                targetLabel = ''; // Reset decrypt target
                
                // Efek Berkedip Merah (Blinking Red)
                if (Math.floor(Date.now() / 200) % 2 === 0) {
                    faceColor = '#FF0055'; 
                } else {
                    faceColor = 'rgba(255, 0, 85, 0.1)'; 
                }
                lastKnownMatch = null;
            }
        } else {
            // DB Offline, hanya deteksi wajah
            resetTargetData();
            updateSystemDiagnostics(0);
            userStatusDisplay.textContent = 'DB OFFLINE';
            faceLabel = 'DB OFFLINE';
            if(userEmotionDisplay) userEmotionDisplay.textContent = 'OFFLINE';
            targetLabel = '';
            faceColor = '#FF00FF'; 
            setStatusVisual('WARNING: NO BIOMETRIC DATABASE FOUND.', 'text-red-500');
            lastKnownMatch = null;
        }
        
        // drawTechBracket(context, box.x, box.y, box.width, box.height, faceColor); // Diganti Sci-Fi HUD
        drawSciFiHUD(context, box.x, box.y, box.width, box.height, faceColor);
        
        // Gunakan Smart HUD baru
        drawSmartHUD(context, box, faceLabel, faceColor, confidence, dominantEmotion);
        drawARDataPoints(context, box, faceColor); // Panggil fungsi AR Data Points
        
        // Gambar Grafik Live di bawah HUD
        drawLiveGraph(context, box.x + box.width + 30, box.y + 80, 180, 40, confidenceHistory, faceColor);

        // Gambar Aliran Data ke Panel Kiri (NEW)
        drawDataStream(context, box, faceColor);
        
        drawDataWaterfall(context, box.x - 40, box.y, box.height, faceColor); // Matrix rain di kiri wajah

        // NEW: Digital Particles (Efek Menguap)
        drawDigitalParticles(context, box, faceColor);

    } else {
        // Tidak ada deteksi wajah
        resetTargetData();
        updateSystemDiagnostics(0);
        // Reset zoom saat tidak ada wajah
        video.style.transform = 'scaleX(-1) scale(1) translate(0, 0)';
        setStatusVisual('SYSTEM READY. AWAITING TARGET...', 'text-gray-300', true);
        confidenceHistory = []; // Reset grafik
        faceParticles = []; // Reset partikel saat wajah hilang
        if(userEmotionDisplay) userEmotionDisplay.textContent = 'SCANNING...';
        targetLabel = '';
        setSystemTheme('IDLE'); // Reset Theme
        lastKnownMatch = null; 
        
        // Draw Idle Radar when no face detected
        drawIdleRadar(context, canvas.width / 2, canvas.height / 2, canvas.height / 3);
    }
}

// --- NEW: HOLOGRAPHIC PARALLAX TILT EFFECT ---
document.addEventListener('mousemove', (e) => {
    // Hanya aktif jika overlay sukses sedang tampil
    if (successOverlay && successOverlay.style.opacity === '1') {
        const card = successOverlay.querySelector('.holo-card');
        if (card) {
            const xAxis = (window.innerWidth / 2 - e.pageX) / 30; // Sensitivitas X
            const yAxis = (window.innerHeight / 2 - e.pageY) / 30; // Sensitivitas Y
            card.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg) scale(1.02)`;
        }
    }
});

// =============================================================================
// 4. PROSES ABSENSI (Koneksi ke /absensi) - PERBAIKAN OVERLAY
// =============================================================================

async function processAttendance(karyawanId) {
    logSystem(`Sending attendance request for ID: ${karyawanId}`, 'text-amber-500');

    if(successOverlay) {
        successOverlay.style.opacity = 0;
        successOverlay.style.pointerEvents = 'none';
        
        // INIT OVERLAY BARU
        // Menggunakan style holo-card sederhana untuk loading
        successOverlay.innerHTML = `
            <div class="holo-card" style="border-color: ${HEADER_COLOR}; text-align: center; justify-content: center;">
                <div class="holo-header" style="justify-content: center;">
                    <span class="text-cyan-400 font-mono tracking-[0.5em] text-2xl animate-pulse">ESTABLISHING UPLINK...</span>
                </div>
                <div class="p-20 flex flex-col items-center justify-center h-full">
                    <h1 class="text-6xl font-black text-white mb-8 tracking-widest glitch-text">PROCESSING BIOMETRICS</h1>
                    <div class="w-full bg-gray-800 h-1 mt-4 rounded overflow-hidden">
                        <div class="h-full bg-cyan-400 animate-[loading_1s_infinite]"></div>
                    </div>
                </div>
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
        
        // --- UPDATE CORNER CARD (POJOK) ---
        if (cornerProfileCard) {
            cornerProfileCard.classList.remove('hidden');
            // Force reflow
            void cornerProfileCard.offsetWidth;
            cornerProfileCard.classList.remove('translate-x-full', 'opacity-0');
            
            if (cornerPhoto) {
                cornerPhoto.src = employeeData.foto ? `data:image/jpeg;base64,${employeeData.foto}` : '';
                cornerPhoto.style.display = employeeData.foto ? 'block' : 'none';
            }
            if (cornerName) cornerName.textContent = display_name;
            if (cornerJabatan) cornerJabatan.textContent = display_jabatan;
            if (cornerId) cornerId.textContent = karyawanId;
            if (cornerStatus) cornerStatus.textContent = result.success ? 'AUTHORIZED' : 'DENIED';
            if (cornerStatus) cornerStatus.className = `text-[10px] font-bold text-black px-2 py-0.5 rounded ${result.success ? 'bg-green-500' : 'bg-red-500'}`;
            cornerProfileCard.style.borderColor = result.success ? '#00FF7F' : '#FF0055';
        }

        // const coloredName = ... (Tidak dipakai lagi di layout baru)
        // const styledJabatan = ... (Tidak dipakai lagi di layout baru)

        let finalStatusText = 'AKSES DITERIMA';
        let finalMessageHTML = '';
        let finalBackground = ABSEN_NORMAL_BG;
        let finalStatusColor = PROFESSIONAL_STATUS_COLOR;
        
        // LOGIKA SUKSES/GAGAL
        if (result.success) {
            // AUDIO & VISUAL SUCCESS
            SoundFX.play('success');
            SoundFX.speak(`Welcome, ${display_name}`);
            triggerScreenFlash('#00FF7F');
            
            setSystemTheme('SUCCESS'); // Theme Green
            if(window.setWarpMode) window.setWarpMode(true); // Trigger 3D Warp

            // Update panel "TARGET DATA" di sisi kiri
            if (userIdDisplay) userIdDisplay.textContent = display_name;
            if (userJabatanDisplay) userJabatanDisplay.textContent = display_jabatan;
            if (userPhotoDisplay) userPhotoDisplay.src = `data:image/jpeg;base64,${employeeData.foto}`;


            setStatusVisual(cleanMessage, displayColor);
            userStatusDisplay.textContent = 'AUTHORIZED';
            userStatusDisplay.className = 'text-lg font-bold ' + displayColor;
            videoContainer.classList.add('scan-success'); 

            // Gunakan result_code untuk logika lebih bersih (jika ada dari server)
            switch (result.result_code) {
                case 'CHECK_IN_SUCCESS':
                    finalStatusText = 'ABSEN MASUK BERHASIL';
                    finalMessageHTML = `Absensi MASUK Terkonfirmasi.<br>Selamat Bekerja.`;
                    finalBackground = ABSEN_NORMAL_BG;
                    finalStatusColor = NAME_HIGHLIGHT_COLOR;
                    logAttendance(display_name, serverTimestamp); // Log ke panel kanan
                    break;
                case 'CHECK_OUT_SUCCESS':
                    finalStatusText = 'CHECK-OUT BERHASIL';
                    finalMessageHTML = `Absensi PULANG Terkonfirmasi.<br>Terima kasih, Hati-hati di jalan.`;
                    finalBackground = ABSEN_NORMAL_BG;
                    finalStatusColor = NAME_HIGHLIGHT_COLOR;
                    break;
                case 'STATUS_CONFIRMED':
                default: // Fallback untuk kasus sukses lainnya
                    finalStatusText = 'STATUS TERKONFIRMASI';
                    finalMessageHTML = `Identitas Terkonfirmasi.<br>Data telah disimpan.`;
                    finalBackground = ABSEN_NORMAL_BG;
                    finalStatusColor = NAME_HIGHLIGHT_COLOR; 
            }

            // UPDATE DIAGNOSTIC PANEL (Full Name List)
            if (diagnosticList) {
                // Hapus placeholder jika ada
                if (diagnosticList.querySelector('.italic')) diagnosticList.innerHTML = '';

                const diagItem = document.createElement('div');
                diagItem.className = 'flex justify-between items-center bg-gray-800/50 p-2 rounded border-l-2 border-green-500 animate-[fadeIn_0.5s_ease-out]';
                diagItem.innerHTML = `
                    <div class="flex flex-col overflow-hidden">
                        <span class="text-cyan-300 font-bold text-xs break-words leading-tight" title="${display_name}">${display_name}</span>
                        <span class="text-[9px] text-gray-400 mt-0.5">${display_jabatan}</span>
                    </div>
                    <span class="text-[10px] font-mono text-green-400 ml-2 whitespace-nowrap font-bold bg-green-900/20 px-1 rounded">${result.result_code.includes('IN') ? 'IN' : 'OUT'}</span>
                `;
                diagnosticList.prepend(diagItem);

                // Batasi jumlah item di list diagnostic agar tidak terlalu panjang
                if (diagnosticList.children.length > 50) {
                    diagnosticList.removeChild(diagnosticList.lastChild);
                }
            }

        } else {
            // Gagal atau Peringatan
            let isWarning = statusColor === 'yellow';

            // --- UPDATE: Penanganan Overlay Spesifik Berdasarkan Kode Server ---
            switch (result.result_code) {
                case 'OUT_OF_TIME_IN':
                    finalStatusText = 'DILUAR JAM MASUK';
                    // Pesan dari server sudah mengandung jam dari .env (misal: "Waktu diizinkan: 07:00 s/d 11:00")
                    finalMessageHTML = `<span style="color:#FF0055;">${cleanMessage}</span>`; 
                    break;
                case 'TOO_EARLY_OUT':
                    finalStatusText = 'DILUAR JAM PULANG';
                    finalMessageHTML = `<span style="color:#FF0055;">${cleanMessage}</span>`;
                    break;
                case 'ALREADY_CHECKED_IN':
                    finalStatusText = 'MOHON TUNGGU'; // Cooldown
                    finalMessageHTML = `<span style="color:#FFD700;">${cleanMessage}</span>`;
                    break;
                case 'ALREADY_CHECKED_OUT':
                    finalStatusText = 'SUDAH PULANG';
                    finalMessageHTML = `<span style="color:#FFD700;">${cleanMessage}</span>`;
                    break;
                default:
                    finalStatusText = isWarning ? 'PERINGATAN' : 'AKSES DITOLAK';
                    finalMessageHTML = `<span style="color:${isWarning ? '#FFD700' : '#FF0055'};">${cleanMessage}</span>`;
            }

            // VISUAL UPDATES (Dipindahkan ke sini agar override isWarning di switch berlaku)
            SoundFX.play('error');
            SoundFX.speak(isWarning ? `Notice, ${display_name}` : `Access Denied, ${display_name}`);
            triggerScreenFlash(isWarning ? '#FFD700' : '#FF0055');
            setSystemTheme('ERROR'); 

            setStatusVisual(`${display_name}: ${cleanMessage}`, isWarning ? 'text-amber-500' : 'text-red-500');
            userStatusDisplay.textContent = isWarning ? 'NOTICE' : 'DENIED';
            userStatusDisplay.className = 'text-lg font-bold ' + (isWarning ? 'text-amber-500' : 'text-red-500');

            // Background: Kuning untuk Warning (Waktu), Merah untuk Error (Wajah Tidak Dikenal)
            finalBackground = isWarning 
                ? `radial-gradient(circle, rgba(200, 150, 0, 0.8) 0%, rgba(100, 80, 0, 0.95) 100%)`
                : `radial-gradient(circle, rgba(255,0,85,0.7) 0%, rgba(153,0,0,0.9) 100%)`;
            
            finalStatusColor = isWarning ? '#FFD700' : '#FF0055';
        }

        // --- GENERATE VISUAL EFFECTS (From Admin ID Card) ---
        // Generate random QR blocks
        const qrBlocks = Array(25).fill(0).map(() => 
            `<div class="w-full h-full bg-cyan-900 ${Math.random() > 0.5 ? 'bg-cyan-400' : 'opacity-20'}"></div>`
        ).join('');

        // Generate floating digital particles
        const particles = Array(20).fill(0).map(() => {
            const left = Math.random() * 100;
            const top = Math.random() * 100;
            const delay = Math.random() * 5;
            const duration = Math.random() * 3 + 2;
            const size = Math.random() * 3 + 1;
            return `<div class="absolute bg-cyan-400 rounded-sm opacity-0" style="left: ${left}%; top: ${top}%; width: ${size}px; height: ${size}px; animation: float-particle ${duration}s linear infinite; animation-delay: -${delay}s; box-shadow: 0 0 4px cyan;"></div>`;
        }).join('');

        // --- NEW: LOGIKA WARNA & ICON STATUS (CUSTOMIZATION) ---
        // Membedakan warna Nama & Box berdasarkan hasil
        let finalNameColor = result.success ? '#00FF7F' : (statusColor === 'yellow' ? '#FFD700' : '#FF0055');
        
        let statusIconSVG = '';
        let statusBoxStyle = '';

        if (result.success) {
            // SUKSES: Icon Ceklis & Gradient Halus
            statusIconSVG = `<svg class="w-10 h-10 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="filter: drop-shadow(0 0 5px ${finalStatusColor});"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7"></path></svg>`;
            statusBoxStyle = `background: linear-gradient(90deg, ${finalStatusColor}33, transparent); border-left: 6px solid ${finalStatusColor};`;
        } else {
            // GAGAL/WARNING: Icon Silang/Seru & Striped Background
            const iconPath = statusColor === 'yellow' 
                ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' // Segitiga Warning
                : 'M6 18L18 6M6 6l12 12'; // Silang Error
            statusIconSVG = `<svg class="w-10 h-10 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="filter: drop-shadow(0 0 5px ${finalStatusColor});"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="${iconPath}"></path></svg>`;
            statusBoxStyle = `background: repeating-linear-gradient(45deg, ${finalStatusColor}20, ${finalStatusColor}20 10px, transparent 10px, transparent 20px); border: 2px solid ${finalStatusColor};`;
        }

        // FINAL OVERLAY RENDER (Profesional & Pesan Sambutan)
        if (successOverlay) {
             // Gunakan background gelap transparan agar ID Card menonjol
             successOverlay.style.background = 'rgba(0, 0, 0, 0.85)';
             successOverlay.innerHTML = `
                <div class="holo-card" style="border-color: ${finalStatusColor}; box-shadow: 0 0 100px ${finalStatusColor}40; position: relative;">
                    <!-- 1. HUD Corners -->
                    <div class="holo-card-corner hc-tl" style="color: ${finalStatusColor}; z-index: 20;"></div>
                    <div class="holo-card-corner hc-tr" style="color: ${finalStatusColor}; z-index: 20;"></div>
                    <div class="holo-card-corner hc-bl" style="color: ${finalStatusColor}; z-index: 20;"></div>
                    <div class="holo-card-corner hc-br" style="color: ${finalStatusColor}; z-index: 20;"></div>

                    <!-- 2. Scanning Beam -->
                    <div class="holo-overlay-beam" style="color: ${finalStatusColor}; z-index: 5;"></div>

                    <!-- 3. Animated Circuit Background -->
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.08; background-image: linear-gradient(${finalStatusColor} 1px, transparent 1px), linear-gradient(90deg, ${finalStatusColor} 1px, transparent 1px); background-size: 40px 40px; animation: gridMove 4s linear infinite; pointer-events: none; z-index: 1;"></div>
                    
                    <!-- Digital Stamp -->
                    <div class="digital-stamp" style="color: ${finalStatusColor}; border-color: ${finalStatusColor}; text-shadow: 0 0 20px ${finalStatusColor}; z-index: 15;">
                        <div class="stamp-inner">
                            <span class="stamp-label">PUSKESMAS WANA</span>
                            <span>${result.success ? 'DITERIMA' : 'DITOLAK'}</span>
                        </div>
                    </div>
                    <div class="impact-dust" style="background: radial-gradient(ellipse at center, ${finalStatusColor} 0%, transparent 70%);"></div>

                    <!-- Cooldown Bar -->
                    <div class="cooldown-track" style="z-index: 20;"><div id="cooldownBar" class="cooldown-progress" style="background: ${finalStatusColor}; box-shadow: 0 0 20px ${finalStatusColor};"></div></div>
                    
                    <div class="holo-header" style="position: relative; z-index: 10;">
                        <div class="flex items-center gap-4">
                            <div class="w-4 h-4 rounded-full animate-pulse" style="background: ${finalStatusColor}"></div>
                            <span class="font-bold tracking-[0.3em] text-xl" style="color: ${finalStatusColor}">PUSKESMAS WANA // GATEWAY</span>
                        </div>
                        <div class="text-lg font-mono opacity-80">${serverTimestamp}</div>
                    </div>

                    <div class="holo-content" style="position: relative; z-index: 10;">
                        <!-- Left: ID CARD REPLACEMENT -->
                        <div class="holo-avatar-container" style="justify-content: center; display: flex; transform: translateY(-50px);">
                            <!-- ID CARD HTML START -->
                            <div class="relative group perspective-[1000px] w-full max-w-[420px]">
                                 <!-- ID Card Content -->
                                 <div class="bg-gradient-to-br from-slate-900 to-black text-white p-0 rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.8)] w-full border border-white/20 relative overflow-hidden font-sans transform transition-all duration-500 hover:scale-[1.02] hover:rotate-y-6 z-10">
                                    
                                    <!-- Header ID Card -->
                                    <div class="relative h-24 bg-gradient-to-r from-emerald-800 to-teal-900 flex items-center px-6 overflow-hidden">
                                        <div class="absolute inset-0 opacity-20" style="background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNmZmZmZmYiLz48L3N2Zz4=');"></div>
                                        <div class="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/30 mr-4 shadow-lg backdrop-blur-sm overflow-hidden">
                                            <img src="logo.jpg" class="w-full h-full object-cover">
                                        </div>
                                        <div class="z-10">
                                            <h2 class="text-xl font-black text-white tracking-widest uppercase leading-none drop-shadow-md">PUSKESMAS WANA</h2>
                                            <p class="text-[10px] text-emerald-100 tracking-[0.3em] mt-1 uppercase font-semibold">Kartu Identitas Pegawai</p>
                                        </div>
                                        <!-- Decorative Line -->
                                        <div class="absolute bottom-0 left-0 w-full h-1 bg-yellow-500"></div>
                                    </div>

                                    <!-- Body -->
                                    <div class="p-6 flex gap-5 items-start bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48ZyBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDQwaDQwVjBIMHY0MHptMjAgMjBoMjBWMjBIMHYyMHpNNDAgNDBWMjBIMHYyMGg0MHoiIGZpbGw9IiMzMzMiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvZz48L3N2Zz4=')]">
                                        <!-- Photo -->
                                        <div class="relative w-28 h-36 flex-shrink-0">
                                            <div class="w-full h-full rounded-lg overflow-hidden border-2 border-white/20 shadow-xl bg-slate-800">
                                                <img src="${employeeData.foto ? `data:image/jpeg;base64,${employeeData.foto}` : ''}" class="w-full h-full object-cover" onerror="this.style.display='none'">
                                            </div>
                                            <!-- Hologram Sticker Effect -->
                                            <div class="absolute -bottom-3 -right-3 w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-yellow-200 border-2 border-white shadow-lg flex items-center justify-center opacity-90">
                                                <span class="text-[6px] font-bold text-yellow-900 text-center leading-tight">RESMI<br>VALID</span>
                                            </div>
                                        </div>

                                        <!-- Info -->
                                        <div class="flex-1 flex flex-col justify-between h-36 py-1">
                                            <div>
                                                <p class="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Nama Lengkap</p>
                                                <h1 class="text-xl font-bold text-white leading-tight mb-3 drop-shadow-sm">${display_name}</h1>
                                                
                                                <p class="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Jabatan</p>
                                                <p class="text-sm font-semibold text-emerald-400 mb-3">${display_jabatan}</p>
                                            </div>
                                            
                                            <div class="flex justify-between items-end border-t border-white/10 pt-2">
                                                <div>
                                                    <p class="text-[9px] text-slate-400 uppercase tracking-wider font-bold">ID Pegawai</p>
                                                    <p class="text-sm font-mono text-slate-200 tracking-wide">${karyawanId}</p>
                                                </div>
                                                <!-- Barcode Dummy -->
                                                <div class="flex flex-col items-end gap-1 opacity-80">
                                                    <div class="h-6 w-16 bg-white p-0.5">
                                                        <div class="h-full w-full bg-[repeating-linear-gradient(90deg,black,black_1px,transparent_1px,transparent_3px)]"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Footer Strip -->
                                    <div class="h-3 bg-slate-900 border-t border-white/10 flex items-center justify-between px-4">
                                        <span class="text-[6px] text-slate-500 tracking-widest">GOVERNMENT HEALTH SERVICE // OFFICIAL ID</span>
                                        <span class="text-[6px] text-slate-500 tracking-widest">SECURE DOC</span>
                                    </div>
                                 </div>
                            </div>
                            <!-- ID CARD HTML END -->
                        </div>
                        
                        <!-- Right: Info & Status -->
                        <div class="holo-info" style="background: rgba(0, 0, 0, 0.3); padding: 20px; border-radius: 12px; border: 1px solid ${finalStatusColor}20; backdrop-filter: blur(4px);">
                            <div class="holo-status-box status-box-animated flex items-center justify-start" style="display: flex; ${statusBoxStyle} padding: 15px 25px; border-radius: 6px; margin-bottom: 25px; width: 100%;">
                                ${statusIconSVG}
                                <span style="font-size: 2.2rem; font-weight: 900; letter-spacing: 3px; color: ${finalStatusColor}; text-shadow: 0 0 15px ${finalStatusColor}; text-transform: uppercase; line-height: 1;">${finalStatusText}</span>
                            </div>

                            <h2 class="holo-name" style="color: ${finalNameColor}; text-shadow: 0 0 30px ${finalNameColor}; font-size: 3.5rem; margin-bottom: 5px;">${display_name}</h2>
                            <p class="holo-role text-cyan-300">${display_jabatan}</p>

                            <div class="holo-message" style="font-size: 1.1em; line-height: 1.5; margin-top: 20px;">
                                ${finalMessageHTML}
                            </div>
                        </div>

                        <!-- Right: Biometrics -->
                        <div class="holo-biometrics">
                            <!-- Fingerprint Row -->
                            <div class="bio-row">
                                <div class="fingerprint-box" style="color: ${finalStatusColor}">
                                    <div class="fingerprint-pattern"></div>
                                    <div class="fingerprint-scan"></div>
                                </div>
                                <div>
                                    <div class="bio-label">BIOMETRIC ID</div>
                                    <div class="bio-value" id="bioIdValue" style="font-size: 1rem;">000000</div>
                                </div>
                            </div>
                            
                            <!-- Vitals Row -->
                            <div class="bio-row">
                                <div class="bio-icon-box" style="padding: 5px;">
                                    <svg viewBox="0 0 100 40" class="w-full h-full">
                                        <path id="ecgPath" d="M 0 20 L 10 20 L 15 10 L 25 30 L 35 15 L 40 20 L 50 20 L 55 25 L 60 20 L 100 20" stroke="${finalStatusColor}" stroke-width="2" fill="none"
                                            stroke-dasharray="280" stroke-dashoffset="280" style="animation: ecgPulse 1.5s linear infinite;"/>
                                    </svg>
                                </div>
                                <div>
                                    <div class="bio-label">VITALS</div>
                                    <div class="bio-value" style="color: ${finalStatusColor};">STABLE</div>
                                </div>
                            </div>

                            <!-- DNA Row -->
                            <div class="bio-row">
                                <div class="bio-cube-container" style="color: ${finalStatusColor}">
                                    <div class="bio-cube">
                                        <div class="front"></div><div class="back"></div>
                                        <div class="right"></div><div class="left"></div>
                                        <div class="top"></div><div class="bottom"></div>
                                    </div>
                                </div>
                                <div>
                                    <div class="bio-label">GENETIC SEQ</div>
                                    <div class="dna-wrapper">
                                        ${Array(6).fill(0).map((_,i) => `<div class="dna-bar" style="background:${finalStatusColor}; animation-delay:${i*0.1}s"></div>`).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="holo-footer" style="position: relative; z-index: 10;">
                        <span class="text-xl">SYSTEM: BIOMETRIC_MATCH_v4.5 [STABLE]</span>
                        <span id="cooldownTimer" class="font-bold text-xl" style="color: ${finalStatusColor}">NEXT SCAN: 15.0s</span>
                    </div>
                </div>
            `;
            
            // Trigger Particle Burst di tengah layar
            const rect = successOverlay.getBoundingClientRect();
            createParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, finalStatusColor);

            // Trigger Screen Shake on Stamp Impact (Sync with CSS animation delay 1.2s + duration 0.4s)
            setTimeout(() => {
                document.body.classList.add('screen-shake');
                setTimeout(() => document.body.classList.remove('screen-shake'), 500);
            }, 1600);

            // --- ANIMASI DECRYPT BIOMETRIC ID (NEW) ---
            const bioIdEl = document.getElementById('bioIdValue');
            if (bioIdEl) {
                let dFrame = 0;
                const dTotal = 30; // Durasi animasi
                const dText = "MATCHED";
                const dInt = setInterval(() => {
                    dFrame++;
                    bioIdEl.textContent = resolveText(dText, dFrame, dTotal); // Menggunakan helper resolveText
                    
                    if (dFrame >= dTotal) {
                        clearInterval(dInt);
                        bioIdEl.textContent = dText;
                    }
                }, 40);
            }
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
        
        // --- COOLDOWN VISUALIZATION LOOP ---
        const startTime = Date.now();
        const cooldownBar = document.getElementById('cooldownBar');
        const cooldownTimer = document.getElementById('cooldownTimer');
        
        while (Date.now() - startTime < SUCCESS_COOLDOWN_MS) {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, SUCCESS_COOLDOWN_MS - elapsed);
            const progress = 100 - ((elapsed / SUCCESS_COOLDOWN_MS) * 100);
            
            if(cooldownBar) cooldownBar.style.width = `${progress}%`;
            if(cooldownTimer) cooldownTimer.textContent = `COOLDOWN: ${(remaining/1000).toFixed(1)}s`;
            
            await new Promise(r => requestAnimationFrame(r));
        }

    } catch (error) {
        SoundFX.play('error');
        triggerScreenFlash('#FF0000');
        
        logSystem(`Attendance Failed: ${error.message}`, 'text-red-500');
        setStatusVisual(`❌ FAILED: ${error.message}`, 'text-red-500');
        userStatusDisplay.textContent = 'FAILED';
        userStatusDisplay.className = 'text-lg font-bold text-red-500';

        if(successOverlay) {
             successOverlay.style.background = `radial-gradient(circle, rgba(255,0,0,0.8) 0%, rgba(100,0,0,0.95) 100%)`;
             successOverlay.innerHTML = `
                <div class="holo-card" style="border-color: #FF0055; box-shadow: 0 0 100px #FF0055;">
                    <div class="holo-header">
                        <span class="text-red-500 font-bold tracking-[0.3em] text-2xl">SYSTEM ALERT</span>
                    </div>
                    <div class="p-20 text-center flex flex-col items-center justify-center h-full">
                        <h1 class="text-6xl font-black text-red-500 mb-8 glitch-text">TRANSMISSION FAILED</h1>
                        <p class="text-white text-2xl mb-8">Gagal terhubung ke server database.</p>
                        <div class="bg-red-900/30 p-8 border border-red-500/50 rounded text-red-300 font-mono text-xl">
                            ERROR: ${error.message}
                        </div>
                    </div>
                </div>
             `;
        }
        await new Promise(resolve => setTimeout(resolve, 3000)); 
    } finally {
        isProcessing = false;
        if(successOverlay) {
            successOverlay.style.opacity = 0;
            successOverlay.style.pointerEvents = 'none';
        }
        // Hide Corner Card
        if (cornerProfileCard) {
            cornerProfileCard.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => cornerProfileCard.classList.add('hidden'), 500);
        }
        logSystem('System ready for next scan.', 'text-gray-300');
        videoContainer.classList.remove('scan-success');
        setSystemTheme('IDLE'); // Reset Theme
        if(window.setWarpMode) window.setWarpMode(false); // Stop Warp
    }
}

// =============================================================================
// 5. ADMIN OVERRIDE SYSTEM (SECRET MENU)
// =============================================================================

const adminOverlay = document.getElementById('adminOverlay');
const adminThresholdInput = document.getElementById('adminThreshold');
const adminThresholdVal = document.getElementById('adminThresholdVal');
const btnCloseAdmin = document.getElementById('btnCloseAdmin');
const btnAdminSave = document.getElementById('btnAdminSave');
const btnAdminReload = document.getElementById('btnAdminReload');

const autofixToggle = document.getElementById('autofixToggle');
const autofixIcon = document.getElementById('autofixIcon');

const btnSecretAdmin = document.getElementById('btnSecretAdmin');

// Toggle Admin Panel dengan CTRL + SHIFT + A
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        toggleAdminPanel();
    }
    // Tutup dengan ESC
    if (e.key === 'Escape' && adminOverlay && !adminOverlay.classList.contains('hidden')) {
        toggleAdminPanel();
    }
});

function toggleAdminPanel() {
    if (!adminOverlay) return;
    
    if (adminOverlay.classList.contains('hidden')) {
        // BUKA PANEL
        console.log("Opening Admin Panel...");
        adminOverlay.classList.remove('hidden');
        SoundFX.play('scan'); // Efek suara
        // Set nilai saat ini ke input
        if(adminThresholdInput) {
            adminThresholdInput.value = String(FACE_MATCHING_THRESHOLD);
            adminThresholdVal.textContent = FACE_MATCHING_THRESHOLD.toFixed(2);
        }
    } else {
        // TUTUP PANEL
        adminOverlay.classList.add('hidden');
    }
}

// --- AUTO-FIX CONFIGURATION LISTENER
let isAutoFixActive = true; // Secara default AUTOFIX ON

if (autofixToggle) {
    autofixToggle.addEventListener('click', () => {
        isAutoFixActive = !isAutoFixActive;
        
        if (isAutoFixActive) {
            // AUTOFIX AKTIF
            autofixToggle.textContent = '[ ON ]';
            autofixToggle.className = 'bg-green-900/20 border border-green-500 text-green-400 text-[10px] px-3 py-1 font-mono hover:border-red-500 hover:text-red-400 transition-all duration-300';
            if(autofixIcon) autofixIcon.className = 'w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#00FF00]';
            logSystem('AUTO-FIX: ACTIVE.', 'text-green-500');
        } else {
            // AUTOFIX MATI
            autofixToggle.textContent = '[ OFF ]';
            autofixToggle.className = 'bg-red-900/20 border border-red-500 text-red-400 text-[10px] px-3 py-1 font-mono hover:border-green-500 hover:text-green-400 transition-all duration-300';
            if(autofixIcon) autofixIcon.className = 'w-2 h-2 rounded-full bg-red-500';
            logSystem('AUTO-FIX: DISABLED.', 'text-red-500');
        }
    });
}





// Event Listeners Admin Panel
if (btnSecretAdmin) {
    btnSecretAdmin.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAdminPanel();
    });
}
if (btnCloseAdmin) btnCloseAdmin.addEventListener('click', toggleAdminPanel);

if (adminThresholdInput) {
    adminThresholdInput.addEventListener('input', (e) => {
        adminThresholdVal.textContent = parseFloat(e.target.value).toFixed(2);
    });
}

if (btnAdminSave) {
    btnAdminSave.addEventListener('click', () => {
        FACE_MATCHING_THRESHOLD = parseFloat(adminThresholdInput.value);
        logSystem(`ADMIN OVERRIDE: Threshold set to ${FACE_MATCHING_THRESHOLD}`, 'text-red-500');
        SoundFX.play('success');
        toggleAdminPanel();
        setStatusVisual(`SECURITY LEVEL UPDATED: ${FACE_MATCHING_THRESHOLD}`, 'text-red-500', true);
    });
}

if (btnAdminReload) {
    btnAdminReload.addEventListener('click', async () => {
        toggleAdminPanel();
        labeledDescriptors = null; // Reset cache
        await loadLabeledImages(); // Reload
        SoundFX.play('scan');
    });
}

function isAutofixEnabled() {
    return isAutoFixActive;
}

// --- FITUR BARU: GLOBAL MATRIX RAIN ---
function initMatrixRain() {
    const canvas = document.getElementById('matrixCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = '01XYZ789アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);

    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; // Trail effect
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#0F0'; // Base Green
        ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < drops.length; i++) {
            const text = chars[Math.floor(Math.random() * chars.length)];
            // Randomly brighter characters (White hot)
            ctx.fillStyle = Math.random() > 0.95 ? '#FFF' : '#00FF7F';
            
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }
    setInterval(draw, 50);
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// --- BABYLON.JS BACKGROUND LOGIC (Dipindahkan dari scan.html) ---
function initBackground3D() {
    // Safety check: Pastikan BABYLON sudah terload sebelum inisialisasi
    if (typeof BABYLON === 'undefined') {
        console.warn("Babylon.js resources failed to load. 3D Background disabled.");
        return;
    }

    // Suppress Babylon.js info logs (like version and engine status)
    BABYLON.Logger.LogLevel = BABYLON.Logger.Error;

    const renderCanvas = document.getElementById("renderCanvas");
    if (!renderCanvas) return;

    const engine = new BABYLON.Engine(renderCanvas, true, { preserveDrawingBuffer: true, stencil: true });

    const createScene = function () {
        const scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color4(0.0, 0.0, 0.0, 0.0); // Transparan

        // 1. CAMERA
        const camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI / 2, Math.PI / 2.5, 20, BABYLON.Vector3.Zero(), scene);
        camera.wheelPrecision = 50;

        // --- FITUR BARU: MOUSE PARALLAX INTERACTION ---
        let mouseX = 0, mouseY = 0;
        window.addEventListener('mousemove', (e) => {
            mouseX = (e.clientX / window.innerWidth) - 0.5;
            mouseY = (e.clientY / window.innerHeight) - 0.5;
        });

        // --- A. BACKGROUND: PROCEDURAL SKYBOX (CUSTOM SHADER) ---
        BABYLON.Effect.ShadersStore["customSkyVertexShader"] = `
            precision highp float;
            attribute vec3 position;
            uniform mat4 world;
            uniform mat4 view;
            uniform mat4 projection;
            varying vec3 vPosition;
            void main() {
                vec4 p = vec4(position, 1.0);
                vPosition = position;
                gl_Position = projection * view * world * p;
            }
        `;

        BABYLON.Effect.ShadersStore["customSkyFragmentShader"] = `
            precision highp float;
            varying vec3 vPosition;
            uniform float time;
            float rand(vec2 co) { return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }
            void main() {
                vec3 dir = normalize(vPosition);
                float s = rand(dir.xy * 50.0 + dir.z * 50.0);
                float stars = step(0.995, s) * (0.5 + 0.5 * sin(time * 2.0 + s * 10.0));
                float atmosphere = max(0.0, dot(dir, vec3(0.0, 1.0, 0.0)));
                vec3 skyColor = mix(vec3(0.0, 0.0, 0.05), vec3(0.05, 0.0, 0.1), atmosphere);
                gl_FragColor = vec4(skyColor + vec3(stars), 1.0);
            }
        `;

        const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
        const skyboxMaterial = new BABYLON.ShaderMaterial("skyBox", scene, {
            vertex: "customSky", fragment: "customSky",
        }, { attributes: ["position"], uniforms: ["world", "view", "projection", "time"] });
        skyboxMaterial.backFaceCulling = false;
        skybox.material = skyboxMaterial;

        // --- B. FOUNDATION: HOLOGRAPHIC GRID ---
        BABYLON.Effect.ShadersStore["holoGridVertexShader"] = `
            precision highp float;
            attribute vec3 position; attribute vec2 uv;
            uniform mat4 world; uniform mat4 view; uniform mat4 projection;
            varying vec3 vPosition; varying vec2 vUV;
            void main() { vPosition = position; vUV = uv; gl_Position = projection * view * world * vec4(position, 1.0); }
        `;

        BABYLON.Effect.ShadersStore["holoGridFragmentShader"] = `
            precision highp float;
            varying vec3 vPosition; varying vec2 vUV;
            uniform float time; uniform vec3 cameraPosition;
            void main() {
                float thickness = 0.05;
                float gridX = step(1.0 - thickness, fract(vPosition.x * 0.2));
                float gridZ = step(1.0 - thickness, fract(vPosition.z * 0.2));
                float grid = max(gridX, gridZ);
                float dist = distance(vPosition, cameraPosition);
                float alpha = max(0.0, 1.0 - dist / 60.0);
                vec3 color = vec3(0.0, 1.0, 1.0) * grid * 2.0;
                float pulse = sin(vPosition.z * 0.5 - time * 2.0);
                color += vec3(0.0, 0.5, 1.0) * max(0.0, pulse) * 0.5 * alpha;
                if (alpha <= 0.01) discard;
                gl_FragColor = vec4(color, alpha * 0.8);
            }
        `;

        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 200, height: 200, subdivisions: 2 }, scene);
        ground.position.y = -5;
        const gridMat = new BABYLON.ShaderMaterial("gridMat", scene, {
            vertex: "holoGrid", fragment: "holoGrid",
        }, { attributes: ["position", "uv"], uniforms: ["world", "view", "projection", "time", "cameraPosition"], needAlphaBlending: true });
        ground.material = gridMat;

        // --- C. VOLUMETRIC LIGHT & GLOBE ---
        const sunMesh = BABYLON.MeshBuilder.CreateSphere("sun", { diameter: 2 }, scene);
        sunMesh.position = new BABYLON.Vector3(0, 5, 30);
        const sunMat = new BABYLON.StandardMaterial("sunMat", scene);
        sunMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        sunMat.disableLighting = true;
        sunMesh.material = sunMat;

        const vls = new BABYLON.VolumetricLightScatteringPostProcess("vls", 1.0, camera, sunMesh, 100, BABYLON.Texture.BILINEAR_SAMPLINGMODE, engine, false);
        vls.exposure = 0.3; vls.decay = 0.96815; vls.weight = 0.98767; vls.density = 0.926;

        const globe = BABYLON.MeshBuilder.CreateSphere("globe", { diameter: 40, segments: 16 }, scene);
        globe.position = new BABYLON.Vector3(0, 10, 40);
        const globeMat = new BABYLON.StandardMaterial("globeMat", scene);
        globeMat.wireframe = true;
        globeMat.emissiveColor = new BABYLON.Color3(0, 0.5, 0.5);
        globeMat.disableLighting = true;
        globe.material = globeMat;
        globe.rotation.z = Math.PI / 4;

        // --- D. PARTICLES ---
        const particleSystem = new BABYLON.GPUParticleSystem("particles", { capacity: 5000 }, scene);
        const particleTexture = new BABYLON.DynamicTexture("pTex", 64, scene);
        const ctx = particleTexture.getContext();
        ctx.beginPath(); ctx.arc(32, 32, 30, 0, 2 * Math.PI); ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; ctx.fill();
        particleTexture.update();
        particleSystem.particleTexture = particleTexture;
        particleSystem.emitter = new BABYLON.Vector3(0, 0, 0);
        particleSystem.minEmitBox = new BABYLON.Vector3(-50, -20, -50); particleSystem.maxEmitBox = new BABYLON.Vector3(50, 20, 50);
        particleSystem.color1 = new BABYLON.Color4(0.0, 1.0, 1.0, 1.0); particleSystem.color2 = new BABYLON.Color4(0.5, 0.0, 1.0, 1.0);
        particleSystem.minSize = 0.1; particleSystem.maxSize = 0.3;
        particleSystem.emitRate = 500;
        particleSystem.start();

        // --- WARP DRIVE CONTROL ---
        let warpActive = false;
        window.setWarpMode = (active) => { warpActive = active; };

        // --- E. INDONESIAN FLAG ORBITER ---
        const flagPivot = new BABYLON.TransformNode("flagPivot", scene);
        flagPivot.position = globe.position;

        const flag = BABYLON.MeshBuilder.CreatePlane("flag", { width: 12, height: 8, subdivisions: 25 }, scene);
        flag.parent = flagPivot;
        flag.position.x = 35; 
        flag.rotation.y = Math.PI / 2; 

        const flagMat = new BABYLON.StandardMaterial("flagMat", scene);
        const flagTexture = new BABYLON.DynamicTexture("flagTex", {width:512, height:256}, scene);
        const ctxFlag = flagTexture.getContext();
        ctxFlag.fillStyle = "#FF0000"; 
        ctxFlag.fillRect(0, 0, 512, 128);
        ctxFlag.fillStyle = "#FFFFFF"; 
        ctxFlag.fillRect(0, 128, 512, 128);
        flagTexture.update();
        flagMat.diffuseTexture = flagTexture;
        flagMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        flagMat.backFaceCulling = false;
        flagMat.disableLighting = true; 
        flag.material = flagMat;
        
        const originalPositions = flag.getVerticesData(BABYLON.VertexBuffer.PositionKind);

        // --- F. CYBER ELEPHANTS (Gajah Futuristik) ---
        const elephants = [];
        const createElephant = (id, radius, startAngle, scale) => {
            const pivot = new BABYLON.TransformNode("pivot" + id, scene);
            pivot.position = globe.position;
            pivot.rotation.y = startAngle;

            const group = new BABYLON.TransformNode("elephant" + id, scene);
            group.parent = pivot;
            group.position.x = radius;

            const mat = new BABYLON.StandardMaterial("eleMat" + id, scene);
            mat.emissiveColor = new BABYLON.Color3(0.4, 0.8, 1); // Cyan Blue
            mat.wireframe = true;

            // Body
            const body = BABYLON.MeshBuilder.CreateBox("body" + id, {width: 4, height: 3.5, depth: 5}, scene);
            body.parent = group;
            body.material = mat;

            // Head
            const head = BABYLON.MeshBuilder.CreateBox("head" + id, {width: 3, height: 3, depth: 3}, scene);
            head.parent = group;
            head.position.z = -3.5;
            head.position.y = 1;
            head.material = mat;

            // Trunk (Belalai)
            const trunk = BABYLON.MeshBuilder.CreateTube("trunk" + id, {
                path: [
                    new BABYLON.Vector3(0, -0.5, -1.6),
                    new BABYLON.Vector3(0, -2, -2),
                    new BABYLON.Vector3(0, -3, -1.5)
                ],
                radius: 0.5,
                cap: BABYLON.Mesh.CAP_ALL
            }, scene);
            trunk.parent = head;
            trunk.material = mat;

            // Legs
            const legSize = {width: 1.2, height: 3, depth: 1.2};
            const l1 = BABYLON.MeshBuilder.CreateBox("l1"+id, legSize, scene); l1.parent = group; l1.position = new BABYLON.Vector3(-1.5, -2.5, 1.5); l1.material = mat;
            const l2 = BABYLON.MeshBuilder.CreateBox("l2"+id, legSize, scene); l2.parent = group; l2.position = new BABYLON.Vector3(1.5, -2.5, 1.5); l2.material = mat;
            const l3 = BABYLON.MeshBuilder.CreateBox("l3"+id, legSize, scene); l3.parent = group; l3.position = new BABYLON.Vector3(-1.5, -2.5, -1.5); l3.material = mat;
            const l4 = BABYLON.MeshBuilder.CreateBox("l4"+id, legSize, scene); l4.parent = group; l4.position = new BABYLON.Vector3(1.5, -2.5, -1.5); l4.material = mat;

            // Ears (Holographic Discs)
            const earMat = mat.clone("earMat"+id);
            earMat.wireframe = false;
            earMat.alpha = 0.3;
            const ear1 = BABYLON.MeshBuilder.CreateDisc("e1"+id, {radius: 2, tessellation: 16}, scene);
            ear1.parent = head; ear1.position.x = -1.6; ear1.rotation.y = Math.PI/4; ear1.material = earMat; ear1.sideOrientation = BABYLON.Mesh.DOUBLESIDE;
            const ear2 = BABYLON.MeshBuilder.CreateDisc("e2"+id, {radius: 2, tessellation: 16}, scene);
            ear2.parent = head; ear2.position.x = 1.6; ear2.rotation.y = -Math.PI/4; ear2.material = earMat; ear2.sideOrientation = BABYLON.Mesh.DOUBLESIDE;

            group.scaling = new BABYLON.Vector3(scale, scale, scale);
            return { pivot, group };
        };

        // Tambahkan 3 Gajah Mengorbit
        elephants.push(createElephant(1, 60, 0, 0.5));
        elephants.push(createElephant(2, 70, 2, 0.4));
        elephants.push(createElephant(3, 55, 4, 0.6));

        // --- G. DRONE SWARM (Armada Penjaga) ---
        const drones = [];
        const createDrone = (radius, speed, offsetY) => {
            const drone = new BABYLON.TransformNode("drone", scene);
            
            // Bentuk Drone (Pyramid)
            const body = BABYLON.MeshBuilder.CreateCylinder("dBody", {diameterTop: 0, diameterBottom: 1.5, height: 2, tessellation: 3}, scene);
            body.parent = drone;
            body.rotation.x = Math.PI / 2; // Menghadap depan
            
            const mat = new BABYLON.StandardMaterial("dMat", scene);
            mat.emissiveColor = new BABYLON.Color3(1, 0.2, 0); // Oranye Neon
            mat.wireframe = true;
            body.material = mat;

            // Engine Glow
            const glow = BABYLON.MeshBuilder.CreateSphere("dGlow", {diameter: 0.5}, scene);
            glow.parent = drone;
            glow.position.z = -1;
            glow.material = mat;

            drones.push({ mesh: drone, radius, speed, angle: Math.random() * Math.PI * 2, offsetY });
        };

        for(let i=0; i<8; i++) createDrone(45 + Math.random()*10, 0.01 + Math.random()*0.01, (Math.random()-0.5)*10);

        let time = 0;
        scene.registerBeforeRender(() => {
            time += 0.01;
            skyboxMaterial.setFloat("time", time);
            gridMat.setFloat("time", time);
            gridMat.setVector3("cameraPosition", camera.position);
            sunMesh.position.x = Math.sin(time * 0.2) * 20; sunMesh.position.y = 5 + Math.cos(time * 0.3) * 5;
            globe.rotation.y += 0.002; globe.rotation.x += 0.001;

            // PARALLAX CAMERA UPDATE (Smooth Follow)
            camera.alpha += ((-Math.PI / 2 + (mouseX * 1.0)) - camera.alpha) * 0.05;
            camera.beta += ((Math.PI / 2.5 + (mouseY * 0.5)) - camera.beta) * 0.05;

            // WARP EFFECT LOGIC
            if (warpActive) {
                particleSystem.emitRate = 2000;
                particleSystem.minSize = 0.5;
                particleSystem.speed = 5;
            } else {
                particleSystem.emitRate = 500;
                particleSystem.minSize = 0.1;
                particleSystem.speed = 1;
            }

            // Flag Animation
            flagPivot.rotation.y -= 0.015; 
            const positions = flag.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 2] = Math.sin(originalPositions[i] * 0.5 + time * 5) * 1.0; 
            }
            flag.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);

            // Elephant Animation
            elephants.forEach((el, idx) => {
                el.pivot.rotation.y += 0.003 * (idx + 1); // Kecepatan orbit variatif
                el.group.position.y = Math.sin(time * 2 + idx) * 2; // Efek melayang naik turun
                el.group.rotation.z = Math.sin(time * 5 + idx) * 0.05; // Sedikit goyangan
            });

            // Drone Animation
            drones.forEach(d => {
                d.angle += d.speed;
                d.mesh.position.x = Math.cos(d.angle) * d.radius;
                d.mesh.position.z = Math.sin(d.angle) * d.radius;
                d.mesh.position.y = d.offsetY + Math.sin(time * 3 + d.angle) * 2;
                d.mesh.lookAt(new BABYLON.Vector3(0, 0, 0)); // Selalu menghadap pusat (Globe)
            });
        });
        
        // --- H. DYNAMIC THEME CONTROLLER (NEW) ---
        // Fungsi ini dipanggil oleh setSystemTheme() untuk mengubah warna dunia 3D
        window.update3DTheme = (status) => {
            let targetColor = new BABYLON.Color3(0, 1, 1); // Default Cyan
            if (status === 'SUCCESS') targetColor = new BABYLON.Color3(0, 1, 0.3); // Green
            if (status === 'ERROR') targetColor = new BABYLON.Color3(1, 0, 0.2); // Red
            
            // Animate Globe Color
            BABYLON.Animation.CreateAndStartAnimation("globeColor", globeMat, "emissiveColor", 30, 30, globeMat.emissiveColor, targetColor, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
            
            // Update Particles Immediate
            particleSystem.color1 = new BABYLON.Color4(targetColor.r, targetColor.g, targetColor.b, 1.0);
            particleSystem.color2 = new BABYLON.Color4(targetColor.r * 0.5, targetColor.g * 0.5, targetColor.b * 0.5, 1.0);
        };
        
        return scene;
    };

    const scene = createScene();
    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
}

// --- START APP (setelah semua HTML siap) ---
document.addEventListener('DOMContentLoaded', () => {
    initBackground3D(); // Inisialisasi Background 3D
    initMatrixRain(); // Inisialisasi Matrix Rain (NEW)
    runBootSequence(); // Jalankan Intro Booting
    initializeApp();
    initVoiceCommands(); // Jalankan Voice Command Listener
    animateTitle();
    updateClock(); // Panggil sekali agar jam langsung muncul, lalu interval akan mengambil alih
    initAudioVisualizer(); // Start Visualizer Loop

    // CSS ADJUSTMENT: Geser area scan (Video Container) sedikit ke atas
    if (videoContainer) {
        videoContainer.style.marginTop = "-40px"; 
    }
});

// --- DEBUGGING TOOL (Tambahan) ---
// Ketik window.cekKoneksi() di Console browser untuk tes manual
window.cekKoneksi = async () => {
    console.log("🔍 TEST KONEKSI DATABASE...");
    try {
        const data = await api.getDescriptors();
        console.log("✅ DATA DITERIMA:", data);
        alert(`KONEKSI SUKSES!\nTotal Wajah: ${data.length}\nLihat Console (F12) untuk detail data.`);
    } catch (e) {
        console.error("❌ ERROR KONEKSI:", e);
        alert(`KONEKSI GAGAL:\n${e.message}`);
    }
};