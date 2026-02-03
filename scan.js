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
let isTargetLocked = false; // Status penguncian target untuk efek suara
let employeeMap = {}; 
let currentStream = null; // Variabel untuk stream kamera aktif
let videoDevices = []; 
// turunkan jadi 80, namun jangan dibawah itu
const DETECTION_INTERVAL_MS = 80; // Interval scan dalam milidetik
const DEFAULT_PHOTO = ''; // Path ke foto default/placeholder jika diperlukan
const SUCCESS_COOLDOWN_MS = 10000; // Jeda 10 detik setelah berhasil scan (Mencegah spam)

// VARS UNTUK EFEK DECRYPT TEXT
let targetLabel = '';
let currentDisplayLabel = '';
let decryptionFrame = 0;
let isStealthMode = false; // Default: Suara Aktif
let confidenceHistory = []; // Untuk grafik live
let recognition; // Variabel untuk Voice Recognition
let faceParticles = []; // NEW: Global particle array
let eyeParticles = []; // NEW: Partikel mata saat berkedip
let isBlinking = false; // Status kedipan

// --- STABILIZER VARS (ANTI-ACAK) ---
let recognitionHistory = []; // Menyimpan hasil deteksi beberapa frame terakhir
const HISTORY_LIMIT = 4;     // [UPDATE] Turunkan ke 5 agar nama lebih CEPAT muncul (Responsif)
const MIN_CONSENSUS = 3;     // [UPDATE] Minimal 3 frame konsisten agar hasil AKURAT (Stabil)
let lockGraceCounter = 0;    // [NEW] Counter untuk menahan hasil lama (Anti-Flicker)
let lastStableResult = null; // [NEW] Menyimpan hasil valid terakhir
let isLastFaceCentered = false; // [NEW] Status posisi wajah frame sebelumnya (untuk warna target)
let lastNosePosition = null; // [NEW] Untuk deteksi kestabilan gerakan
let stabilityCounter = 0;    // [NEW] Counter frame stabil
let userScanCounters = {};   // [NEW] Counter scan per user session

// --- LIVENESS DETECTION ENGINE (ANTI-SPOOFING) ---
class LivenessDetector {
    constructor() {
        this.movementDetected = false;
        this.lastYaw = 0;
    }

    reset() {
        this.movementDetected = false;
        this.lastYaw = 0;
    }

    update(landmarks) {
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        
        // Estimasi Yaw (Rotasi Kepala) untuk UI AR
        const nose = landmarks.getNose()[3];
        const leftEyeCenter = leftEye[0]; 
        const rightEyeCenter = rightEye[3]; 
        const faceWidth = Math.abs(rightEyeCenter.x - leftEyeCenter.x);
        if (faceWidth > 0) {
            const noseRel = (nose.x - leftEyeCenter.x) / faceWidth;
            this.lastYaw = (noseRel - 0.5) * 2; 
        }

        // Logika Deteksi Gerakan Kepala (Yaw)
        // Jika kepala menoleh ke kiri/kanan (Threshold 0.2)
        if (Math.abs(this.lastYaw) > 0.2) {
            this.movementDetected = true;
        }

        return this.movementDetected;
    }
}
// Inisialisasi Global Liveness Check
window.LivenessCheck = new LivenessDetector();

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
        } else if (type === 'shutter_crack') {
            // [NEW] Heavy Mechanical Latch Unlock (Suara Buka Kunci Berat)
            const t = audioCtx.currentTime;
            
            // 1. Low Thud (Hentakan Besi)
            const osc1 = audioCtx.createOscillator();
            const g1 = audioCtx.createGain();
            osc1.connect(g1); g1.connect(audioAnalyser);
            osc1.type = 'square';
            osc1.frequency.setValueAtTime(100, t);
            osc1.frequency.exponentialRampToValueAtTime(20, t + 0.2);
            g1.gain.setValueAtTime(0.8, t);
            g1.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc1.start(t); osc1.stop(t + 0.2);

            // 2. Metallic Clank (Denting Logam)
            const osc2 = audioCtx.createOscillator();
            const g2 = audioCtx.createGain();
            osc2.connect(g2); g2.connect(audioAnalyser);
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(1200, t);
            osc2.frequency.exponentialRampToValueAtTime(100, t + 0.15);
            g2.gain.setValueAtTime(0.2, t);
            g2.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            osc2.start(t); osc2.stop(t + 0.15);

        } else if (type === 'shutter_open') {
            // [NEW] Hydraulic Hiss & Heavy Slide (Suara Pintu Geser Hidrolik)
            const t = audioCtx.currentTime;
            const duration = 3.5; // Diperpanjang untuk efek berat

            // 1. White Noise (Steam/Hydraulics) - Procedural Noise Buffer
            const bufferSize = audioCtx.sampleRate * duration;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            const noiseFilter = audioCtx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(800, t);
            noiseFilter.frequency.linearRampToValueAtTime(2000, t + 2.0); // Filter opens up slower
            
            const noiseGain = audioCtx.createGain();
            noiseGain.gain.setValueAtTime(0.6, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(audioAnalyser);
            noise.start(t);

            // 2. Low Rumble (Heavy Door Moving)
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.connect(g); g.connect(audioAnalyser);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(60, t);
            osc.frequency.linearRampToValueAtTime(30, t + duration);
            g.gain.setValueAtTime(0.4, t);
            g.gain.linearRampToValueAtTime(0, t + duration);
            osc.start(t); osc.stop(t + duration);
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
            utterance.pitch = 1.1; // [UPDATE] Pitch lebih tinggi untuk suara perempuan
            utterance.volume = 0.9;
            
            // [UPDATE] Cari suara Bahasa Indonesia (id-ID)
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.lang === 'id-ID' && (v.name.includes('Google') || v.name.includes('Female'))) || voices.find(v => v.lang === 'id-ID');
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

    window.audioLevel = 0; // Init global var
    function renderFrame() {
        requestAnimationFrame(renderFrame);
        audioAnalyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Style Visualizer
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        let total = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2; // Scale height
            total += dataArray[i];
            
            // Warna Gradient Cyan ke Ungu
            ctx.fillStyle = `rgba(0, 255, 255, ${barHeight / 100})`;
            ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight); // Center vertical
            x += barWidth + 1;
        }
        window.audioLevel = total / bufferLength; // Rata-rata level suara (0-255)
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

let FACE_MATCHING_THRESHOLD = 0.47; // [UPDATE] Diperketat ke 0.40 untuk Akurasi Tinggi (Anti-Acak)
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
        else if (command.includes('status') || command.includes('report')) SoundFX.speak('Sistem Normal. Basis Data Terhubung.');
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
    const time = Date.now() / 1000;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    
    // EFEK BARU: Garis putus-putus yang mengalir (seperti data dikirim)
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -time * 30; 

    const drawContour = (points, close = false) => {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        if (close) ctx.closePath();
        ctx.stroke();
    };

    // Gambar kontur fitur wajah (Jaw, Brows, Nose, Eyes, Mouth)
    drawContour(landmarks.getJawOutline(), false);
    drawContour(landmarks.getLeftEyeBrow(), false);
    drawContour(landmarks.getRightEyeBrow(), false);
    drawContour(landmarks.getNose(), false);
    drawContour(landmarks.getLeftEye(), true);
    drawContour(landmarks.getRightEye(), true);
    drawContour(landmarks.getMouth(), true);

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

// --- FITUR BARU: TACTICAL HUD (Pengganti Sci-Fi HUD) ---
function drawTacticalHUD(ctx, box, color) {
    const { x, y, width: w, height: h } = box;
    const time = Date.now() / 1000;
    const cx = x + w / 2;
    const cy = y + h / 2;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    // 1. CORNER BRACKETS (Dynamic Expansion)
    const padding = 20;
    const len = 40;
    const breathe = Math.sin(time * 3) * 5;
    
    // Top Left
    ctx.beginPath();
    ctx.moveTo(x - padding - breathe, y - padding - breathe + len);
    ctx.lineTo(x - padding - breathe, y - padding - breathe);
    ctx.lineTo(x - padding - breathe + len, y - padding - breathe);
    ctx.stroke();
    
    // Top Right
    ctx.beginPath();
    ctx.moveTo(x + w + padding + breathe - len, y - padding - breathe);
    ctx.lineTo(x + w + padding + breathe, y - padding - breathe);
    ctx.lineTo(x + w + padding + breathe, y - padding - breathe + len);
    ctx.stroke();
    
    // Bottom Right
    ctx.beginPath();
    ctx.moveTo(x + w + padding + breathe, y + h + padding + breathe - len);
    ctx.lineTo(x + w + padding + breathe, y + h + padding + breathe);
    ctx.lineTo(x + w + padding + breathe - len, y + h + padding + breathe);
    ctx.stroke();
    
    // Bottom Left
    ctx.beginPath();
    ctx.moveTo(x - padding - breathe + len, y + h + padding + breathe);
    ctx.lineTo(x - padding - breathe, y + h + padding + breathe);
    ctx.lineTo(x - padding - breathe, y + h + padding + breathe - len);
    ctx.stroke();

    // 2. ROTATING TARGET CIRCLE
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.4, time, time + Math.PI * 1.5);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.35, -time * 2, -time * 2 + Math.PI);
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. CROSSHAIR
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
    ctx.stroke();

    // 4. DATA BLOCKS (Decorations)
    // Top Bar
    ctx.fillRect(cx - 30, y - padding - breathe - 15, 60, 4);
    // Bottom Bar
    ctx.fillRect(cx - 30, y + h + padding + breathe + 11, 60, 4);

    ctx.restore();
}

// --- FITUR BARU: VISUAL GUIDE OVERLAY (Lingkaran Target) ---
function drawGuideOverlay(ctx, w, h, isCentered = false) {
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.28; // Ukuran target (sesuai area deteksi optimal)

    // [UPDATE] Logika Warna Dinamis (Cyan = Standby, Hijau = Pas)
    const baseColor = isCentered ? '0, 255, 127' : '0, 255, 255'; // RGB: SpringGreen vs Cyan
    const strokeStyle = `rgba(${baseColor}, ${isCentered ? 0.8 : 0.15})`; // Lebih terang jika pas

    ctx.save();
    // 1. Lingkaran Target (Putus-putus)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = strokeStyle; 
    ctx.lineWidth = 2;
    ctx.setLineDash([15, 15]); 
    ctx.stroke();

    // 2. Crosshair Tengah
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    // 3. Teks Panduan
    const blinkAlpha = 0.5 + Math.abs(Math.sin(Date.now() / 500)) * 0.5; // [UPDATE] Opacity lebih terang (0.5 - 1.0)
    ctx.font = 'bold 16px "Courier New", monospace'; // [UPDATE] Font lebih besar & tebal
    
    // [NEW] Background Kotak Hitam Transparan agar lebih terbaca
    // [UPDATE] Teks berubah jika posisi pas
    const text = isCentered ? "POSISI PAS - TAHAN" : "POSISIKAN WAJAH DI SINI";
    
    const textMetrics = ctx.measureText(text);
    const boxWidth = textMetrics.width + 40; // Beri padding horizontal
    const boxHeight = 32;
    const boxX = cx - (boxWidth / 2);
    const boxY = cy + radius + 35 - 24; // Posisikan di atas baseline teks

    ctx.fillStyle = `rgba(0, 10, 20, ${0.7 * blinkAlpha})`; // Warna background sinkron dengan kedipan
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    
    // [UPDATE] Warna Teks: Hijau jika pas, Kuning jika belum
    ctx.fillStyle = isCentered ? `rgba(0, 255, 127, ${blinkAlpha})` : `rgba(255, 255, 0, ${blinkAlpha})`;
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, cy + radius + 35);

    // 4. Panah Animasi (Pointing Inward)
    // Jarak dasar dari lingkaran + animasi bounce (gerak 8px)
    const arrowDist = radius + 20; 
    const arrowBounce = Math.abs(Math.sin(Date.now() / 500)) * 8; 
    const arrowSize = 8; // [UPDATE] Panah sedikit lebih besar

    const drawPointer = (angle) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.translate(0, -(arrowDist + arrowBounce)); // Pindah ke posisi luar
        
        // Gambar Segitiga
        ctx.beginPath();
        ctx.moveTo(0, 0); // Ujung (menunjuk ke pusat)
        ctx.lineTo(-arrowSize, -arrowSize * 1.5); 
        ctx.lineTo(arrowSize, -arrowSize * 1.5); 
        ctx.closePath();
        // [UPDATE] Warna Panah mengikuti status (Hijau/Kuning)
        ctx.fillStyle = isCentered ? `rgba(0, 255, 127, ${blinkAlpha})` : `rgba(255, 255, 0, ${blinkAlpha})`;
        ctx.fill();
        ctx.restore();
    };

    // Gambar 4 arah
    drawPointer(0);            // Atas
    drawPointer(Math.PI / 2);  // Kanan
    drawPointer(Math.PI);      // Bawah
    drawPointer(-Math.PI / 2); // Kiri

    ctx.restore();
}

// --- FITUR BARU: DYNAMIC SCREEN CORNERS (Siku-Siku Layar) ---
function drawDynamicScreenCorners(ctx, w, h, box, color) {
    const pad = 30;  // Jarak dasar dari pinggir layar
    const len = 40;  // Panjang garis siku
    let offX = 0, offY = 0;
    
    // Animasi Breathing saat Idle (Bergerak pelan jika tidak ada wajah)
    const breathe = box ? 0 : Math.sin(Date.now() / 800) * 5;

    if (box) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        // Parallax Effect: Sudut bergerak MENGIKUTI posisi wajah (Dynamic Framing)
        // Memberikan efek kedalaman 3D seolah HUD sedang tracking wajah
        offX = ((cx - w/2) / (w/2)) * 25; 
        offY = ((cy - h/2) / (h/2)) * 25;
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.lineCap = 'square';

    const drawCorner = (x, y, dx, dy) => {
        ctx.beginPath();
        ctx.moveTo(x + (dx * len), y); // Garis Horizontal
        ctx.lineTo(x, y);              // Titik Sudut
        ctx.lineTo(x, y + (dy * len)); // Garis Vertikal
        ctx.stroke();
    };

    drawCorner(pad + offX - breathe, pad + offY - breathe, 1, 1);       // Kiri Atas
    drawCorner(w - pad + offX + breathe, pad + offY - breathe, -1, 1);  // Kanan Atas
    drawCorner(w - pad + offX + breathe, h - pad + offY + breathe, -1, -1); // Kanan Bawah
    drawCorner(pad + offX - breathe, h - pad + offY + breathe, 1, -1);  // Kiri Bawah

    ctx.restore();
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

    // DEBUG LIVENESS: Ambil nilai EAR dari modul LivenessCheck
    const yawVal = window.LivenessCheck ? window.LivenessCheck.lastYaw.toFixed(2) : '0.50'; // NEW: Debug Yaw

    // Data points dengan nilai acak untuk efek visual
    const data = [
        { label: 'TEMP', value: (36.5 + Math.random() * 0.5).toFixed(1) + '°C', pos: [x + w + 5, y + 10] },
        { label: 'PULSE', value: (70 + Math.floor(Math.random() * 5)) + ' BPM', pos: [x + w + 5, y + h - 5] },
        { label: 'YAW', value: `${yawVal}`, pos: [x - 5, y + h - 5], align: 'right' } // Tampilkan nilai rotasi kepala
    ];

    data.forEach(d => {
        ctx.textAlign = d.align || 'left';
        ctx.fillText(`[${d.label}: ${d.value}]`, d.pos[0], d.pos[1]);
    });

    ctx.restore();
}

// --- FITUR BARU: FACE SHAPE CONNECTOR (Membentuk Wajah) ---
function drawFaceShape(ctx, landmarks, color, isPulsing = false) {
    const points = landmarks.positions;
    ctx.save();
    ctx.strokeStyle = color;
    
    if (isPulsing) {
        const pulse = Math.abs(Math.sin(Date.now() / 150));
        ctx.lineWidth = 1.5 + (pulse * 2.5); // Berdenyut tebal tipis
        ctx.shadowBlur = 5 + (pulse * 15);
        ctx.globalAlpha = 0.8 + (pulse * 0.2);
    } else {
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 5;
    }

    ctx.shadowColor = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Helper untuk menggambar path dari array index
    const drawPath = (indices, close = false) => {
        ctx.beginPath();
        ctx.moveTo(points[indices[0]].x, points[indices[0]].y);
        for (let i = 1; i < indices.length; i++) {
            const p = points[indices[i]];
            ctx.lineTo(p.x, p.y);
        }
        if (close) ctx.closePath();
        ctx.stroke();
    };

    // 1. Kontur Wajah (Jawline)
    drawPath([...Array(17).keys()]); // 0-16

    // 2. Alis
    drawPath([17, 18, 19, 20, 21]); // Kiri
    drawPath([22, 23, 24, 25, 26]); // Kanan

    // 3. Hidung
    drawPath([27, 28, 29, 30]); // Batang hidung
    drawPath([31, 32, 33, 34, 35]); // Cuping hidung

    // 4. Mata
    drawPath([36, 37, 38, 39, 40, 41], true); // Kiri
    drawPath([42, 43, 44, 45, 46, 47], true); // Kanan

    // 5. Mulut
    drawPath([...Array(12).keys()].map(i => i + 48), true); // Bibir Luar
    drawPath([...Array(8).keys()].map(i => i + 60), true);  // Bibir Dalam

    // 6. Titik-titik Landmark (Nodes)
    ctx.fillStyle = color;
    points.forEach((pt, i) => { if(i%2===0) { ctx.beginPath(); ctx.arc(pt.x, pt.y, 1, 0, Math.PI*2); ctx.fill(); } });

    ctx.restore();
}

// --- [GOD-LEVEL] HOLOGRAPHIC FACE RECONSTRUCTION ENGINE ---
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
    ctx.restore();
}

// --- FITUR BARU: EYE BLINK PARTICLES (Partikel Digital Mata) ---
function getEAR(eye) {
    const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (v1 + v2) / (2.0 * h);
}

function drawEyeParticles(ctx) {
    for (let i = eyeParticles.length - 1; i >= 0; i--) {
        let p = eyeParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;

        if (p.life <= 0) {
            eyeParticles.splice(i, 1);
        } else {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.font = '12px "Courier New", monospace';
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 5;
            ctx.fillText(p.char, p.x, p.y);
            ctx.restore();
        }
    }
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

// --- VISUAL FX: GLITCH EFFECT ---
function triggerGlitch() {
    const container = document.getElementById('videoContainer');
    if (container) {
        container.classList.add('glitch-active');
        // Random shift
        const shiftX = (Math.random() - 0.5) * 20;
        const shiftY = (Math.random() - 0.5) * 10;
        container.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
        
        setTimeout(() => {
            container.classList.remove('glitch-active');
            container.style.transform = 'none';
        }, 150);
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

// [NEW] HELPER: HASH ANIMATION
function animateHash(elementId, length = 64) {
    const target = document.getElementById(elementId);
    if (!target) return;

    const chars = '0123456789ABCDEF';
    let frame = 0;
    const totalFrames = 30; // Animation duration
    
    const interval = setInterval(() => {
        frame++;
        let output = '';
        for (let i = 0; i < length; i++) {
            // Animate character by character based on progress
            if (frame > totalFrames * (i / length)) {
                output += chars[Math.floor(Math.random() * chars.length)];
            } else {
                // Use a placeholder for characters not yet "decrypted"
                output += '-';
            }
        }
        target.textContent = output;

        if (frame >= totalFrames) {
            clearInterval(interval);
            // Generate a final "locked" hash
            target.textContent = Array.from({length}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        }
    }, 50);
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
    setTimeout(() => SoundFX.speak("Sistem Online. Sensor Optik Dikalibrasi."), 1000);

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
function drawSmartHUD(ctx, box, label, color, confidence, emotion = 'ANALYZING', gender = '-', age = '-') {
    const padding = 10;
    const tagX = box.x + box.width + 30; // Posisi di kanan wajah
    const tagY = box.y;
    const hudWidth = 180;
    const hudHeight = 90; // [UPDATE] Dipertinggi agar muat info Gender/Umur

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

    // 8. Gender & Age Readout (NEW)
    ctx.fillStyle = '#FFD700'; // Warna Emas
    ctx.fillText(`BIO: ${gender.toUpperCase()} / ${age} YRS`, tagX + 15, tagY + 87);
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
    
    // FIX: Ambil elemen secara dinamis karena di-inject via JS (animateTitle)
    const clockH = document.getElementById('clock-h');
    const clockM = document.getElementById('clock-m');
    const clockS = document.getElementById('clock-s');
    const clockDate = document.getElementById('clock-date');

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
        sigerContainer.style.marginBottom = '20px'; // Jarak bawah diperbaiki agar tidak tertimpa
        sigerContainer.style.marginTop = '10px'; 
        sigerContainer.innerHTML = `
        <div style="
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            width: 100%; 
            max-width: 640px; /* Samakan dengan lebar video */
            margin: 0 auto; 
            padding: 15px; /* Padding diperbesar agar foto tidak sesak */
            border: 1px solid rgba(0, 255, 255, 0.6); 
            border-radius: 12px;
            background: rgba(0, 20, 30, 0.6);
            backdrop-filter: blur(5px);
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.2);
            animation: floatLogo 4s ease-in-out infinite; 
        ">
            <!-- NEW WRAPPER with flex-direction: row -->
            <div style="display: flex; flex-direction: row; align-items: center; justify-content: center; width: 100%; gap: 15px;">
                
                <!-- LEFT DATA BLOCK -->
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-family: 'Courier New', monospace; color: #00FFFF; text-transform: uppercase;">
                    <div style="font-size: 9px; letter-spacing: 2px; opacity: 0.8; color: #00FF7F; margin-bottom: 2px;">SYSTEM TIME</div>
                    <div style="display: flex; align-items: baseline; gap: 2px; font-weight: bold; text-shadow: 0 0 10px rgba(0,255,255,0.6);">
                        <span id="clock-h" style="font-size: 28px; line-height: 1;">--</span>
                        <span style="font-size: 18px; opacity: 0.8; animation: blink 1s infinite;">:</span>
                        <span id="clock-m" style="font-size: 28px; line-height: 1;">--</span>
                        <span id="clock-s" style="font-size: 14px; color: #FFD700; margin-left: 2px;">--</span>
                    </div>
                    <div style="width: 80%; height: 1px; background: linear-gradient(90deg, transparent, #00FFFF, transparent); margin: 4px 0;"></div>
                    <div id="clock-date" style="font-size: 9px; transform: scale(0.9);">--</div>
                </div>

                <!-- CENTER IMAGE -->
                <div style="flex: 2.5; height: 120px; position: relative; overflow: hidden; border-radius: 8px; border: 1px solid #00FFFF; box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);">
                    <img src="pkm.jpg" alt="Banner" style="width: 100%; height: 100%; object-fit: cover; object-position: center; animation: holo-flicker 5s infinite;">
                    <!-- Scanline Overlay -->
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.1) 3px); pointer-events: none;"></div>
                    <img src="pkm.jpg" alt="Banner" style="width: 100%; height: 100%; object-fit: cover; object-position: center; image-rendering: auto;">
                </div>

                <!-- RIGHT DATA BLOCK -->
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; font-family: 'Courier New', monospace; font-size: 10px; color: #00FFFF; text-transform: uppercase;">
                    <div style="font-weight: bold; letter-spacing: 1px;">BIOMETRIC KERNEL</div>
                    <div style="width: 80%; height: 20px; display: flex; gap: 2px; align-items: flex-end; border: 1px solid #00FFFF33; padding: 2px;">
                        <div class="data-bar" style="width: 20%; background: #00FFFF;"></div>
                        <div class="data-bar" style="width: 20%; background: #00FFFF;"></div>
                        <div class="data-bar" style="width: 20%; background: #00FFFF;"></div>
                        <div class="data-bar" style="width: 20%; background: #00FFFF;"></div>
                        <div class="data-bar" style="width: 20%; background: #00FFFF;"></div>
                    </div>
                    <div style="width: 80%; height: 1px; background: #00FFFF; margin-top: 2px;"></div>
                    <div style="font-size: 12px; font-weight: bold; color: #FFD700;">v4.5 STABLE</div>
                </div>

            </div>
            <div style="width: 80%; height: 2px; background: linear-gradient(90deg, transparent, #00FFFF, transparent); margin-top: 12px; opacity: 0.8; box-shadow: 0 0 5px #00FFFF;"></div>
        </div>
        <style>
            @keyframes floatLogo {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-5px); }
            }
            @keyframes pulse-green {
                0% { box-shadow: 0 0 5px #00FF7F; }
                50% { box-shadow: 0 0 15px #00FF7F; }
                100% { box-shadow: 0 0 5px #00FF7F; }
            }
            @keyframes bar-pulse {
                0% { height: 20%; opacity: 0.7; }
                50% { height: 100%; opacity: 1; }
                100% { height: 20%; opacity: 0.7; }
            }
            .data-bar {
                animation: bar-pulse 1.5s ease-in-out infinite;
            }
            .data-bar:nth-child(2) { animation-delay: 0.2s; }
            .data-bar:nth-child(3) { animation-delay: 0.5s; }
            .data-bar:nth-child(4) { animation-delay: 0.3s; }
            .data-bar:nth-child(5) { animation-delay: 0.6s; }
            
            @keyframes holo-flicker {
                0%, 100% { opacity: 1; filter: brightness(1) hue-rotate(0deg); }
                2% { opacity: 0.5; filter: brightness(1.5) hue-rotate(90deg); transform: skewX(2deg); }
                4% { opacity: 1; filter: brightness(1) hue-rotate(0deg); transform: skewX(0deg); }
                25% { opacity: 0.8; }
                26% { opacity: 0.4; filter: brightness(1.2); }
                27% { opacity: 0.8; }
                70% { filter: hue-rotate(0deg); }
                72% { filter: hue-rotate(180deg) brightness(1.5); }
                74% { filter: hue-rotate(0deg); }
            }
        </style>`;
        
        mainTitle.parentNode.insertBefore(sigerContainer, mainTitle);
    }
    
    // Setup awal: Buat span jika belum sesuai (Hanya sekali)
    if (mainTitle.children.length !== targetText.length) {
        mainTitle.innerHTML = '';
        
        // --- SETUP LOGO DI SAMPING JUDUL ---
        const mainLogo = document.getElementById('mainLogo');
        if (mainLogo) {
            mainLogo.style.display = 'block';
            mainLogo.style.position = 'fixed';
            mainLogo.style.top = '15px';
            mainLogo.style.left = '30px';
            mainLogo.style.width = '60px';
            mainLogo.style.height = '60px';
            mainLogo.style.zIndex = '101';
            mainLogo.style.filter = 'drop-shadow(0 0 8px rgba(0,255,255,0.6))';
        }

        // --- POSISI JUDUL: POJOK KIRI ATAS (HUD STYLE) ---
        mainTitle.style.position = 'fixed';
        mainTitle.style.top = '25px';
        mainTitle.style.left = '100px'; // Geser ke kanan (30px + 60px logo + 10px gap)
        mainTitle.style.zIndex = '100';
        mainTitle.style.margin = '0';

        mainTitle.style.opacity = '1';
        mainTitle.style.display = 'inline-flex';
        mainTitle.style.gap = '4px'; 
        mainTitle.style.perspective = '1000px'; // Efek 3D
        
        // GAYA HURUF BARU: Lebih tebal, solid, dan futuristik
        mainTitle.style.fontFamily = '"Rajdhani", "Orbitron", "Arial Black", sans-serif';
        mainTitle.style.fontWeight = '900';
        mainTitle.style.fontSize = 'clamp(1.5rem, 2vw, 2.5rem)'; // Ukuran Header
        mainTitle.style.letterSpacing = '4px';
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
            span.style.color = '#FFD700'; 
            span.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
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
                textShadow = '0 0 20px #FFFFFF, 0 0 40px #FFD700, 0 0 60px #FF4500';
                transform = 'scale(1.2) translateZ(20px)';
                opacity = '1';
            } else if (dist < 3) {
                color = '#0088FF'; // Blue Trail
                textShadow = '0 0 15px #0088FF';
                color = '#FFA500'; // Orange Trail
                textShadow = '0 0 15px #FFA500';
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

// --- NEW: PERSONNEL ROSTER ---
let rosterScrollInterval = null;

async function updatePersonnelRoster() {
    if (!personnelRoster) return;
    
    try {
        // Ambil data absensi hari ini dari server
        const data = await api.getTodayAttendance();
        
        personnelRoster.innerHTML = '';
        personnelRoster.style.overflow = 'auto';
        
        if (!data || data.length === 0) {
            personnelRoster.innerHTML = '<div class="text-gray-500 text-xs italic text-center py-4">Belum ada data kehadiran hari ini.</div>';
            return;
        }

        const contentWrapper = document.createElement('div');
        contentWrapper.style.width = '100%';

        data.forEach(row => {
            // Ambil foto dari cache employeeMap jika ada, atau gunakan placeholder
            const empData = employeeMap[row.id_karyawan] || {};
            const photoSrc = empData.foto ? `data:image/jpeg;base64,${empData.foto}` : 'logo.jpg';
            
            // Tentukan status (Masuk/Pulang)
            const isOut = !!row.jam_keluar;
            const timeDisplay = isOut ? `OUT: ${row.jam_keluar.substring(0,5)}` : `IN: ${row.jam_masuk.substring(0,5)}`;
            const statusColor = isOut ? 'bg-amber-500 shadow-[0_0_5px_#F59E0B]' : 'bg-green-500 shadow-[0_0_5px_#00FF00]';
            const statusText = isOut ? 'SUDAH PULANG' : 'HADIR';
            const borderColor = isOut ? 'border-amber-500/50' : 'border-green-500/50';
            const bgHover = isOut ? 'hover:bg-amber-900/20' : 'hover:bg-green-900/20';

            const item = document.createElement('div');
            item.className = `flex items-center gap-3 p-2.5 border-b border-cyan-900/30 ${bgHover} transition-colors duration-200 animate-[fadeIn_0.5s_ease-out]`;
            
            item.innerHTML = `
                <div class="relative w-12 h-12 flex-shrink-0">
                    <img src="${photoSrc}" class="w-full h-full rounded-md object-cover border ${borderColor} bg-gray-800">
                    <div class="absolute -bottom-1 -right-1 w-3 h-3 ${statusColor} rounded-full border border-black animate-pulse" title="${statusText}"></div>
                </div>
                <div class="flex-grow min-w-0">
                    <p class="font-bold text-xs text-white truncate leading-tight">${row.nama}</p>
                    <p class="text-[10px] text-cyan-300 truncate opacity-80">${row.jabatan || '-'}</p>
                    <div class="flex justify-between items-center mt-1">
                        <p class="text-[10px] text-gray-400 font-mono bg-black/30 px-1 rounded">${timeDisplay}</p>
                        ${isOut ? '<span class="text-[9px] text-amber-500 font-bold">PULANG</span>' : '<span class="text-[9px] text-green-500 font-bold">AKTIF</span>'}
                    </div>
                </div>
            `;
            contentWrapper.appendChild(item);
        });
        
        personnelRoster.appendChild(contentWrapper);

    } catch (e) {
        console.error("Roster update failed", e);
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
        try {
            const response = await fetch('/api/absensi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_karyawan: karyawanId })
            });
            if (!response.ok) throw new Error(`Server Error (${response.status})`);
            return await response.json();
        } catch (e) {
            // Tangani error jaringan (ECONNRESET / Server Down)
            if (e.name === 'TypeError' || e.message.includes('fetch')) {
                throw new Error("CONNECTION LOST: Server tidak merespon (ECONNRESET).");
            }
            throw e;
        }
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

        const descriptors = [];
        
        descriptorsData.forEach(item =>{
            // 1. Masukkan SEMUA pegawai ke Map (untuk Roster)
            employeeMap[item.id_karyawan] = {
                nama: item.nama,
                jabatan: item.jabatan || 'N/A',
                foto: item.foto, // Simpan foto base64
                hasFace: !!item.face_descriptor // Flag punya wajah atau tidak
            };

            // 2. Hanya masukkan ke Engine Deteksi jika punya data wajah
            if (item.face_descriptor) {
                const rawData = typeof item.face_descriptor === 'string' ? JSON.parse(item.face_descriptor) : item.face_descriptor;
                let float32Arrays = [];

                // Cek apakah Single Descriptor (Legacy) atau Multi Descriptor (New)
                if (Array.isArray(rawData)) {
                    if (rawData.length > 0 && typeof rawData[0] === 'number') {
                        // Format Lama: [0.1, 0.2, ...]
                        float32Arrays.push(new Float32Array(rawData));
                    } else if (rawData.length > 0 && Array.isArray(rawData[0])) {
                        // Format Baru: [[0.1, ...], [0.2, ...]]
                        rawData.forEach(d => float32Arrays.push(new Float32Array(d)));
                    }
                }

                if (float32Arrays.length > 0) {
                    descriptors.push(new faceapi.LabeledFaceDescriptors(item.id_karyawan, float32Arrays));
                }
            }
        });

        
        // --- PANGGIL FUNGSI BARU SETELAH employeeMap SIAP ---
        updatePersonnelRoster();

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
        // [FIX] Jangan sembunyikan panel induk karena ada Ambulance Display & Kontrol Lain
        if (videoDevices.length > 1) { 
            cameraSelect.style.display = 'block'; 
        } else {
             cameraSelect.style.display = 'none'; // Hanya sembunyikan dropdown jika cuma 1 kamera
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
        
        // VISUAL BOOST: Terangkan tampilan video (Brightness 130%) agar user nyaman saat gelap
        video.style.filter = 'brightness(1.3) contrast(1.1)';
        
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
            // Update Roster Visual juga saat load awal
            updatePersonnelRoster();
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
            faceapi.nets.faceExpressionNet.loadFromUri('./models'), // NEW: Load Emotion Model
            faceapi.nets.ageGenderNet.loadFromUri('./models') // [NEW] Load Age & Gender Model
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

       // Tambahkan style/class di sini untuk frame video saat scanning dimulai
       videoContainer.classList.add('scanning-border');

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

// --- HELPER: GEOMETRY CHECK (AKURASI TINGGI) ---
function checkFaceGeometry(landmarks) {
    const nose = landmarks.getNose()[3];
    const leftJaw = landmarks.getJawOutline()[0];
    const rightJaw = landmarks.getJawOutline()[16];
    
    // Hitung rasio simetri wajah (Yaw)
    const distLeft = Math.abs(nose.x - leftJaw.x);
    const distRight = Math.abs(nose.x - rightJaw.x);
    const total = distLeft + distRight;
    const yawRatio = total === 0 ? 0.5 : distLeft / total; // 0.5 = Tegak Lurus Sempurna
    
    // 2. ROLL (Miring Kiri/Kanan) - [NEW]
    const leftEye = landmarks.getLeftEye()[0];
    const rightEye = landmarks.getRightEye()[3];
    const dy = rightEye.y - leftEye.y;
    const dx = rightEye.x - leftEye.x;
    const rollAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    return {
        isFrontal: yawRatio > 0.42 && yawRatio < 0.58, // Toleransi sempit (harus lurus)
        isLevel: Math.abs(rollAngle) < 10, // [NEW] Toleransi miring max 10 derajat
        yaw: yawRatio,
        roll: rollAngle
    };
}

async function detectFace() {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    // [NEW] Gambar Lingkaran Target di Tengah Layar (Panduan Posisi)
    // [UPDATE] Gunakan status frame sebelumnya agar warna responsif
    // drawGuideOverlay(context, canvas.width, canvas.height, isLastFaceCentered);

    if (isProcessing) return; // Jangan lakukan apapun jika sedang memproses absensi
    if (video.paused || video.ended || !faceapi.nets.tinyFaceDetector.params || !labeledDescriptors) return;
    
    const displaySize = { width: canvas.width, height: canvas.height };

    // LOW LIGHT OPTIMIZATION: scoreThreshold diturunkan (0.50 -> 0.30) agar wajah gelap/samar tetap terdeteksi
    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.3 })) // [UPDATE] Turunkan threshold deteksi agar wajah lebih mudah tertangkap, filter dilakukan saat matching
	.withFaceLandmarks()
    .withFaceExpressions() // NEW: Detect Expressions
    .withAgeAndGender() // [NEW] Detect Age & Gender
    .withFaceDescriptor();

    // Efek transisi ketika wajah terdeteksi dan frame aktif
    if (detections) {
        // NEW: Tambahkan frame pembatas (border) di sekitar video
        videoContainer.classList.add('scanning-border');
        // Hapus inline style lama jika ada agar class CSS berlaku
        videoContainer.style.border = ''; 
        videoContainer.style.boxShadow = '';
    } else {
         // Jika tidak ada wajah terdeteksi, reset style ke semula (hilangkan border)
         videoContainer.classList.remove('scanning-border', 'scanning-border-error');
         videoContainer.style.border = 'none';
         videoContainer.style.boxShadow = 'none';
     }

    if(!isProcessing) videoContainer.classList.remove('scan-success');

    if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const { box } = resizedDetections.detection;
        const { landmarks } = resizedDetections;

        // --- ANALISIS EMOSI (NEW) ---
        const expressions = resizedDetections.expressions;
        const sortedEmotions = Object.keys(expressions).sort((a, b) => expressions[b] - expressions[a]);
        const dominantEmotion = sortedEmotions[0] || 'NEUTRAL';

        // [NEW] Extract Gender & Age
        const gender = resizedDetections.gender || '-';
        const age = Math.round(resizedDetections.age) || 0;

        // --- FITUR: STABILISASI KAMERA (NO ZOOM) ---
        // Zoom dihapus agar resolusi tajam & orientasi stabil seperti HUD Taktis.
        video.style.transform = 'scaleX(-1)'; 

        // --- GAMBAR EFEK CANGGIH BARU ---

        // 1. Hexagonal Force Field di latar belakang wajah
        // drawHexGridOverlay(context, box, '#00FFFF');
        
        // 2. Topographic Map (Garis Kontur)
        // drawTopographicFeatures(context, landmarks, '#00FFFF');

        // drawHolographicMesh(context, landmarks);
        
        // GAMBAR KONEKTOR BIOMETRIK (NEW)
        // drawBiometricConnectors(context, box, landmarks, '#00FFFF');

        // GAMBAR RETINAL SCAN (NEW)
        // drawRetinalScan(context, landmarks, '#00FFFF');

        // --- GAMBAR EFEK BARU ---
        // drawScanningBeam(context, box); // Diganti dengan HUD Sci-Fi
        // drawTacticalHUD(context, box, '#00FFFF');
        
        const nose = landmarks.getNose()[3]; // Titik tengah hidung
        // drawTargetLock(context, nose.x, nose.y, box.width * 0.3); // Diganti Sci-Fi HUD
        
        // --- EFEK SUARA: TARGET ACQUIRED ---
        if (!isTargetLocked) {
            SoundFX.play('scan'); // Bunyi "Chirp" saat pertama kali wajah terkunci
            isTargetLocked = true;
        }

        // --- LOGIKA BARU: RECOGNITION DULU -> BARU LIVENESS ---
        // 1. Lakukan Pengenalan Wajah Terlebih Dahulu (Agar nama langsung muncul)
        let faceLabel = 'UNKNOWN';
        let faceColor = '#FF0055'; 
        let confidence = 0;
        let recognizedId = null;
        let employee = null;
        let bestMatch = null; // Define bestMatch scope

        // --- FILTER AKURASI TINGGI (STRICT MODE) ---
        // 1. Filter Ukuran: Wajah harus cukup besar (> 130px) agar detail terlihat jelas
        const isQualityFace = box.width > 110;
        
        // 2. Filter Posisi: Wajah harus di tengah (Toleransi 25% dari pusat)
        const centerX = box.x + box.width / 2;
        const imgCenter = displaySize.width / 2;
        const isCentered = Math.abs(centerX - imgCenter) < (displaySize.width * 0.25);

        // 3. Filter Sudut: Wajah harus menghadap lurus ke kamera
        const geometry = checkFaceGeometry(landmarks);
        const isFrontal = geometry.isFrontal;
        const isLevel = geometry.isLevel; // [NEW]

        // 4. Filter Kestabilan (Anti-Blur) - [NEW]
        const currentNose = landmarks.getNose()[3];
        let isStable = false;
        if (lastNosePosition) {
            const movement = Math.hypot(currentNose.x - lastNosePosition.x, currentNose.y - lastNosePosition.y);
            if (movement < 5) { // Gerakan < 5 pixel dianggap stabil
                stabilityCounter++;
            } else {
                stabilityCounter = 0; // Reset jika bergerak
            }
        }
        lastNosePosition = currentNose;
        isStable = stabilityCounter > 2; // Harus stabil minimal 3 frame (approx 300ms)

        // [UPDATE] Update status global: Hijau jika Cukup Besar (Dekat) DAN Di Tengah
        isLastFaceCentered = true;

        if (labeledDescriptors && labeledDescriptors.length > 0) {
            const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, FACE_MATCHING_THRESHOLD);
            bestMatch = faceMatcher.findBestMatch(detections.descriptor);
            const matchDistance = bestMatch.distance;
            
            // Hitung Confidence
            const confidenceRaw = Math.max(0, FACE_MATCHING_THRESHOLD - matchDistance); 
            confidence = (confidenceRaw / FACE_MATCHING_THRESHOLD) * 100;
            
            // Update Grafik Diagnostik
            confidenceHistory.push(confidence);
            if (confidenceHistory.length > 50) confidenceHistory.shift();
            updateSystemDiagnostics(confidence);

        } else {
            // DB Offline
            faceLabel = 'DB OFFLINE';
            faceColor = '#FF00FF';
            updateSystemDiagnostics(0);
        }

        // --- LOGIKA STABILIZER (VOTING SYSTEM) ---
        // Mencegah hasil berubah-ubah (flickering) dengan mengambil suara terbanyak dari N frame terakhir
        if (bestMatch) {
            // [UPDATE] Turbo Match: Jika sangat mirip (< 0.25), langsung isi penuh history agar INSTAN
            if (bestMatch.distance < 0.25) {
                // Push berkali-kali agar langsung menang voting (Bypass antrian)
                for(let i=0; i<MIN_CONSENSUS; i++) recognitionHistory.push(bestMatch.label);
            }
            recognitionHistory.push(bestMatch.label);
            
            // Jaga ukuran history buffer
            while (recognitionHistory.length > HISTORY_LIMIT) recognitionHistory.shift();
        } else {
            // Jika wajah hilang/tidak terdeteksi, reset history perlahan atau langsung
            if (recognitionHistory.length > 0) recognitionHistory.shift();
        }

        // Hitung Modus (Label yang paling sering muncul)
        const counts = {};
        let maxCount = 0;
        let stabilizedLabel = 'unknown';

        recognitionHistory.forEach(label => {
            counts[label] = (counts[label] || 0) + 1;
            if (counts[label] > maxCount) {
                maxCount = counts[label];
                stabilizedLabel = label;
            }
        });

        // Hanya anggap valid jika konsensus terpenuhi
        if (stabilizedLabel !== 'unknown' && maxCount >= MIN_CONSENSUS) {
            recognizedId = stabilizedLabel;
            
            // [NEW] Smart Locking: Simpan hasil valid & reset grace period
            lastStableResult = recognizedId;
            lockGraceCounter = 12; // Tahan hasil selama ~1.2 detik jika wajah goyang/hilang
            
            employee = employeeMap[recognizedId] || { nama: `ID:${recognizedId}`, jabatan: 'N/A' };
            faceLabel = employee.nama;
            faceColor = '#00FF7F'; // Hijau (Match)
        } else {
            // [NEW] Grace Period Logic (Anti-Acak)
            // Jika hasil jadi unknown tapi kita punya lock baru-baru ini, pertahankan hasil lama sebentar
            if (lockGraceCounter > 0 && lastStableResult) {
                recognizedId = lastStableResult;
                lockGraceCounter--; // Kurangi durasi tahan
                
                employee = employeeMap[recognizedId] || { nama: `ID:${recognizedId}`, jabatan: 'N/A' };
                faceLabel = employee.nama; // Tetap tampilkan nama (Stabil)
                faceColor = '#00FF7F';
            } else {
                // Benar-benar unknown atau grace period habis
                recognizedId = null;
                lastStableResult = null;
                
                if (maxCount > 1) {
                    faceLabel = "VERIFYING...";
                    faceColor = "#00FFFF"; 
                }
            }
        }

        // 2. Cek Liveness (Gerakan/Kedipan) secara background

        const isLive = true; // MODIFIKASI: Bypass sensor gerakan kepala (Normal Mode)

        // 3. Logika UI & Eksekusi
        if (recognizedId) {
            // --- WAJAH DIKENALI ---
            
            // Efek Decrypt Nama
            if (faceLabel !== targetLabel) {
                targetLabel = faceLabel;
                decryptionFrame = 0;
            }
            if (decryptionFrame < 15) {
                decryptionFrame++;
                faceLabel = resolveText(targetLabel, decryptionFrame, 15);
            }

            // Update Panel Kiri (Foto & Nama) - Langsung Tampil agar user tahu dia dikenali
            if (!lastKnownMatch || lastKnownMatch.id !== recognizedId) {
                if (userPhotoDisplay) userPhotoDisplay.src = `data:image/jpeg;base64,${employee.foto}`;
                videoContainer.classList.remove('scanning-border-error'); // Reset ke Cyan (Normal) jika dikenali
                
                // [NEW] Update Ambulance Status to DISPATCHED (Green)
                const ambStatus = document.getElementById('amb-status');
                if (ambStatus) {
                    ambStatus.textContent = 'DISPATCHED';
                    ambStatus.style.color = '#00FF7F';
                    ambStatus.style.textShadow = '0 0 10px #00FF00';
                }

                if (userIdDisplay) animateText(userIdDisplay, employee.nama);
                if (userJabatanDisplay) animateText(userJabatanDisplay, employee.jabatan || 'N/A');
                
                // Trigger efek scan foto
                if (photoContainer) {
                    photoContainer.classList.remove('photo-scan-active');
                    void photoContainer.offsetWidth; 
                    photoContainer.classList.add('photo-scan-active');
                }
            }

            // Update Emosi
            if(userEmotionDisplay) userEmotionDisplay.textContent = dominantEmotion.toUpperCase();

            // CEK LIVENESS UNTUK EKSEKUSI
            if (isLive) {
                // SUDAH BERGERAK -> PROSES ABSEN
                userStatusDisplay.textContent = 'VERIFYING...';
                userStatusDisplay.className = 'text-lg font-bold text-amber-500';
                setSystemTheme('SUCCESS');

                if (!isProcessing) { 
                    setStatusVisual(`LIVENESS CONFIRMED. AUTHORIZING ${employee.nama}...`, 'text-cyan-400', true);
                    setStatusVisual(`AUTHORIZING ${employee.nama}...`, 'text-cyan-400', true);
                    isProcessing = true;
                    // Simpan match terakhir sebelum proses absensi
                    lastKnownMatch = { id: recognizedId, box: resizedDetections.detection.box, landmarks: resizedDetections.landmarks, faceLabel: faceLabel, faceColor: faceColor };
                    
                    if(window.LivenessCheck) window.LivenessCheck.reset(); // Reset status liveness
                    await processAttendance(recognizedId);
                }
            } else {
                // BELUM BERGERAK -> MINTA GERAKAN (TAPI NAMA SUDAH MUNCUL)
                setStatusVisual(`HALO ${employee.nama}. GERAKKAN KEPALA UNTUK ABSEN`, 'text-yellow-400', true);
                userStatusDisplay.textContent = 'MOVE HEAD';
                userStatusDisplay.className = 'text-lg font-bold text-yellow-400 animate-pulse';
                setSystemTheme('SCANNING');
                
                // Ubah warna HUD jadi Kuning (Waiting)
                faceColor = '#FFD700'; 
            }

        } else {
            // --- WAJAH TIDAK DIKENAL / DB OFFLINE ---
            resetTargetData();
            
            // [FIX] Cek apakah sedang dalam mode instruksi (Wajah terdeteksi tapi belum pas)
            // Jika faceLabel sudah berisi instruksi (misal "TAHAN POSISI"), jangan ditimpa jadi "UNKNOWN"
            
            // [NEW] Revert Ambulance Status
            const ambStatus = document.getElementById('amb-status');
            if (ambStatus && ambStatus.textContent !== 'EMERGENCY UNIT') {
                ambStatus.textContent = 'EMERGENCY UNIT';
                ambStatus.style.color = '#FF3333';
                ambStatus.style.textShadow = '0 0 10px #FF0000';
            }

            const isInstruction = ["DEKATKAN WAJAH", "POSISIKAN DI TENGAH", "LIHAT LURUS", "KEPALA TEGAK", "TAHAN POSISI"].includes(faceLabel);

            if (isInstruction) {
                // Mode Instruksi: Tampilkan pesan kuning (Guidance)
                videoContainer.classList.remove('scanning-border-error');
                setStatusVisual(faceLabel, 'text-yellow-400', true); // Pulsing
                userStatusDisplay.textContent = 'ALIGNING';
                userStatusDisplay.className = 'text-lg font-bold text-yellow-400';
                // faceColor sudah diset kuning/cyan di logika filter sebelumnya
            } else {
                // Mode Unknown: Benar-benar tidak dikenal (Merah)
                videoContainer.classList.add('scanning-border-error'); // Ubah border jadi Merah
                if (labeledDescriptors && labeledDescriptors.length > 0) {
                    // Unknown Face
                    setStatusVisual('SCANNING..', 'text-red-500');
                    userStatusDisplay.textContent = 'ACCESS DENIED';
                    faceLabel = 'UNKNOWN';
                    faceColor = '#FF0055';
                    
                    // Efek Berkedip Merah
                    if (Math.floor(Date.now() / 200) % 2 === 0) faceColor = '#FF0055'; 
                    else faceColor = 'rgba(255, 0, 85, 0.1)';

                    // Trigger Glitch Effect on Unknown Face (Interference)
                    if (Math.random() < 0.15) triggerGlitch();
                } else {
                    // DB Offline
                    setStatusVisual('WARNING: NO BIOMETRIC DATABASE FOUND.', 'text-red-500');
                    userStatusDisplay.textContent = 'DB OFFLINE';
                }
            }
            
            if(userEmotionDisplay) userEmotionDisplay.textContent = 'UNKNOWN';
            targetLabel = '';
            lastKnownMatch = null;
        }
        
        // drawTechBracket(context, box.x, box.y, box.width, box.height, faceColor); // Diganti Sci-Fi HUD
        // drawTacticalHUD(context, box, faceColor);
        
        // Gunakan Smart HUD baru
        // drawSmartHUD(context, box, faceLabel, faceColor, confidence, dominantEmotion, gender, age);
        drawHolographicMesh(context, landmarks);
        // [NEW] Draw Face Shape (Visualisasi Wajah)
        const isVerifying = faceLabel.includes('VERIFYING') || (userStatusDisplay && userStatusDisplay.textContent.includes('VERIFYING'));
        drawFaceShape(context, landmarks, faceColor, isVerifying);

        // --- DETEKSI KEDIPAN & PARTIKEL DIGITAL ---
        const leftEyePts = landmarks.getLeftEye();
        const rightEyePts = landmarks.getRightEye();
        const avgEAR = (getEAR(leftEyePts) + getEAR(rightEyePts)) / 2;

        if (avgEAR < 0.22) { // Threshold kedipan (mata tertutup)
            if (!isBlinking) {
                isBlinking = true;
                // Emit Digital Particles (Burst)
                const emitParticles = (points) => {
                    let cx=0, cy=0;
                    points.forEach(p=>{cx+=p.x; cy+=p.y});
                    cx/=points.length; cy/=points.length;
                    
                    for(let i=0; i<8; i++) {
                        eyeParticles.push({ x: cx, y: cy, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 1) * 6 - 2, life: 1.0, color: '#00FFFF', char: Math.random() > 0.5 ? '1' : '0' });
                    }
                };
                emitParticles(leftEyePts);
                emitParticles(rightEyePts);
            }
        } else {
            isBlinking = false;
        }
        drawEyeParticles(context);
        
        // [NEW] Gambar Siku-Siku Layar yang Bergerak (Dynamic Corners)
        // drawDynamicScreenCorners(context, canvas.width, canvas.height, box, faceColor);

        // drawARDataPoints(context, box, faceColor); // Panggil fungsi AR Data Points
        
        // Gambar Grafik Live di bawah HUD
        // drawLiveGraph(context, box.x + box.width + 30, box.y + 80, 180, 40, confidenceHistory, faceColor);

        // Gambar Aliran Data ke Panel Kiri (NEW)
        // drawDataStream(context, box, faceColor);
        
        // drawDataWaterfall(context, box.x - 40, box.y, box.height, faceColor); // Matrix rain di kiri wajah

        // NEW: Digital Particles (Efek Menguap)
        // drawDigitalParticles(context, box, faceColor);

        // Random Ambient Glitch (Signal Noise)
        if (Math.random() < 0.005) triggerGlitch();

    } else {
        // Tidak ada deteksi wajah
        if(window.LivenessCheck) window.LivenessCheck.reset();
        resetTargetData();
        
        // [NEW] Revert Ambulance Status (No Face)
        const ambStatus = document.getElementById('amb-status');
        if (ambStatus && ambStatus.textContent !== 'EMERGENCY UNIT') {
            ambStatus.textContent = 'EMERGENCY UNIT';
            ambStatus.style.color = '#FF3333';
            ambStatus.style.textShadow = '0 0 10px #FF0000';
        }

        isTargetLocked = false; // Reset status lock
        updateSystemDiagnostics(0);
        // [UPDATE] Jangan langsung kosongkan history agar Grace Period bekerja
        if (recognitionHistory.length > 0) recognitionHistory.shift(); 
        
        // Reset transform (tetap mirror)
        video.style.transform = 'scaleX(-1)';
        setStatusVisual('SYSTEM READY. AWAITING TARGET...', 'text-gray-300', true);
        confidenceHistory = []; // Reset grafik
        faceParticles = []; // Reset partikel saat wajah hilang
        if(userEmotionDisplay) userEmotionDisplay.textContent = 'SCANNING...';
        targetLabel = '';
        setSystemTheme('IDLE'); // Reset Theme
        lastKnownMatch = null; 
        
        // Draw Idle Radar when no face detected
        // drawIdleRadar(context, canvas.width / 2, canvas.height / 2, canvas.height / 3);
        isLastFaceCentered = false; // [UPDATE] Reset status jika wajah hilang
        
        // [NEW] Gambar Siku-Siku Layar (Mode Idle/Breathing)
        // drawDynamicScreenCorners(context, canvas.width, canvas.height, null, '#00FFFF');
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
                    <span class="text-cyan-400 font-mono tracking-[0.5em] text-2xl animate-pulse">MENGHUBUNGKAN SERVER...</span>
                </div>
                <div class="p-20 flex flex-col items-center justify-center h-full">
                    <h1 class="text-6xl font-black text-white mb-8 tracking-widest glitch-text">MEMPROSES BIOMETRIK</h1>
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
        
        // [NEW] LOGIKA COUNTER SCAN (UX TWEAK)
        if (!userScanCounters[karyawanId]) userScanCounters[karyawanId] = 0;
        
        // Jika Check-In Berhasil, reset counter jadi 1. Jika tidak (termasuk warning), increment.
        if (result.result_code === 'CHECK_IN_SUCCESS') {
            userScanCounters[karyawanId] = 1;
        } else {
            userScanCounters[karyawanId]++;
        }

        // [NEW] INTERCEPT: UBAH WARNING JADI KONFIRMASI (SCAN KE-2)
        // Jika scan ke-2 dan server menolak karena "Sudah Masuk/Belum Jam Pulang", ubah jadi Konfirmasi Hijau.
        if (!result.success && (result.result_code === 'TOO_EARLY_OUT' || result.result_code === 'ALREADY_CHECKED_IN')) {
            if (userScanCounters[karyawanId] <= 2) {
                result.success = true;
                result.result_code = 'ALREADY_IN_CONFIRMATION';
                result.statusColor = 'green';
                result.message = 'Absensi Masuk Sudah Terkonfirmasi.';
            }
        }

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
        let welcomeMessage = ''; // Variabel baru untuk pesan selamat datang
        
        // LOGIKA SUKSES/GAGAL
        if (result.success) {
            // AUDIO & VISUAL SUCCESS
            SoundFX.play('success');
            
            // [NEW] Sapaan Waktu Otomatis
            const hour = new Date().getHours();
            let timeGreeting = 'Pagi';
            if (hour >= 11 && hour < 15) timeGreeting = 'Siang';
            else if (hour >= 15 && hour < 19) timeGreeting = 'Sore';
            else if (hour >= 19 || hour < 4) timeGreeting = 'Malam';
            
            // [NEW] Pesan Motivasi Acak
            const quotes = [
                "Semoga harimu menyenangkan.",
                "Tetap semangat melayani masyarakat.",
                "Jaga kesehatan dan tetap fokus.",
                "Mari berikan pelayanan terbaik.",
                "Jangan lupa senyum, sapa, salam, sopan, dan santun.",
                "Kerja ikhlas adalah ibadah.",
                "Semangat mengabdi untuk negeri."
            ];
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            
            // [UPDATE] Logika Pesan Suara Berbeda untuk Masuk vs Pulang
            if (result.result_code === 'CHECK_OUT_SUCCESS') {
                SoundFX.speak(`Sampai Jumpa ${display_name}. Hati-hati di jalan.`);
            } else {
                SoundFX.speak(`Selamat Datang di Puskesmas Wana. Selamat ${timeGreeting}, ${display_name}. ${randomQuote}`);
            }
            
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
                    // [UPDATE] Logika Tepat Waktu vs Terlambat
                    if (result.telat_menit > 0) {
                        finalStatusText = `TERLAMBAT`;
                        finalMessageHTML = `Absensi MASUK Terkonfirmasi.<br><span style="color:#FFD700; font-weight:900; font-size: 2.5rem; line-height: 1.2; display:block; margin-top:10px; text-shadow: 0 0 15px #FFD700, 0 0 30px #FFD700;">+ ${result.telat_menit} MENIT</span>`;
                        finalStatusColor = '#FFD700'; // Kuning Emas
                        finalBackground = `radial-gradient(circle, rgba(255, 215, 0, 0.8) 0%, rgba(100, 80, 0, 0.95) 100%)`;
                    } else {
                        finalStatusText = 'TEPAT WAKTU';
                        finalStatusText = 'ABSEN MASUK BERHASIL';
                        finalMessageHTML = `Absensi MASUK Terkonfirmasi.<br><span style="color:#00FF7F; font-weight:bold; font-size: 1.8rem; display:block; margin-top:10px; text-shadow: 0 0 15px #00FF7F, 0 0 30px #00FF7F;">SELAMAT BEKERJA</span>`;
                        finalBackground = ABSEN_NORMAL_BG;
                        finalStatusColor = '#00FF7F'; // Hijau Spring
                    }
                    // Tambahkan pesan selamat datang setelah warna ditentukan
                    welcomeMessage = `<div id="welcomeMessageTarget" class="text-lg font-semibold tracking-wider mb-1" style="color: ${finalStatusColor}CC; text-shadow: 0 0 5px ${finalStatusColor}; min-height: 28px;"></div>`;
                    logAttendance(display_name, serverTimestamp); // Log ke panel kanan
                    updatePersonnelRoster(); // Refresh Roster Visual
                    break;
                case 'CHECK_OUT_SUCCESS':
                    // LOGIKA BARU: Cek apakah PSW (Status Yellow)
                    if (statusColor === 'yellow') {
                        finalStatusText = 'PULANG CEPAT (PSW)';
                        // Gunakan pesan dari server yang berisi detail menit PSW
                        finalMessageHTML = `<span style="color:#FFD700; font-weight:bold; text-shadow: 0 0 15px #FFD700;">${cleanMessage}</span>`;
                        finalStatusColor = '#FFD700'; // Kuning Emas
                        finalBackground = `radial-gradient(circle, rgba(255, 215, 0, 0.8) 0%, rgba(100, 80, 0, 0.95) 100%)`;
                    } else {
                        finalStatusText = 'CHECK-OUT BERHASIL';
                        finalMessageHTML = `Absensi PULANG Terkonfirmasi.<br><span style="text-shadow: 0 0 10px #FFD700;">Terima kasih, Hati-hati di jalan.</span>`;
                        finalStatusColor = '#FFD700'; // [MODIFIED] Ubah ke Emas untuk Check-Out Normal
                        finalBackground = ABSEN_NORMAL_BG;
                    }
                    updatePersonnelRoster(); // Refresh Roster Visual
                    break;
                case 'ALREADY_IN_CONFIRMATION':
                    finalStatusText = 'SUDAH ABSEN MASUK';
                    finalMessageHTML = `<span style="color:#00FF7F; font-weight:bold; font-size: 1.5rem;">DATA TERKONFIRMASI</span><br>Anda sudah melakukan absen masuk.`;
                    finalBackground = ABSEN_NORMAL_BG;
                    finalStatusColor = '#00FF7F';
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
                    finalMessageHTML = `<span style="color:${isWarning ? '#FFD700' : '#FF0055'}; font-weight:bold; font-size: 1.5rem; display:block; margin-top:10px; text-shadow: 0 0 15px ${isWarning ? '#FFD700' : '#FF0055'}, 0 0 30px ${isWarning ? '#FFD700' : '#FF0055'};">${cleanMessage}</span>`;
            }

            // VISUAL UPDATES (Dipindahkan ke sini agar override isWarning di switch berlaku)
            SoundFX.play('error');
            SoundFX.speak(isWarning ? `Peringatan, ${display_name}` : `Akses Ditolak, ${display_name}`);
            setSystemTheme('ERROR'); 

            setStatusVisual(`${display_name}: ${cleanMessage}`, isWarning ? 'text-amber-500' : 'text-red-500');
            userStatusDisplay.textContent = isWarning ? 'NOTICE' : 'DENIED';
            userStatusDisplay.className = 'text-lg font-bold ' + (isWarning ? 'text-amber-500' : 'text-red-500');

            // Background: Kuning untuk Warning (Waktu), Merah untuk Error (Wajah Tidak Dikenal)
            finalBackground = isWarning 
                ? `radial-gradient(circle, rgba(255, 215, 0, 0.8) 0%, rgba(100, 80, 0, 0.95) 100%)`
                : `radial-gradient(circle, rgba(255, 0, 85, 0.8) 0%, rgba(100, 0, 0, 0.95) 100%)`;
            
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
        // FIX: Jika statusColor kuning (PSW), nama juga ikut kuning meskipun success=true
        let finalNameColor = statusColor === 'green' ? '#00FF7F' : (statusColor === 'yellow' ? '#FFD700' : '#FF0055');
        
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
            // --- [NEW] Academic & Advanced Stamp SVGs ---
            const guillocheSvg = `<svg width='100' height='100' xmlns='http://www.w3.org/2000/svg'><path d='M 0,50 C 25,0 75,100 100,50 M 0,50 C 25,100 75,0 100,50' stroke='${finalStatusColor}' stroke-width='0.5' fill='none' opacity='0.2'/><path d='M 50,0 C 0,25 100,75 50,100 M 50,0 C 100,25 0,75 50,100' stroke='${finalStatusColor}' stroke-width='0.5' fill='none' opacity='0.2'/></svg>`;
            const watermarkSvg = `<svg width='300' height='300' xmlns='http://www.w3.org/2000/svg'><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='"Times New Roman", serif' font-size='30' font-weight='bold' fill='${finalStatusColor}' opacity='0.06' transform='rotate(-45 150 150)'>PUSKESMAS WANA</text></svg>`;

            // [NEW] Advanced High-Tech Background SVGs
            const circuitSvg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="circuit" patternUnits="userSpaceOnUse" width="50" height="50"><path d="M0 25h25M25 0v25" stroke="${finalStatusColor}" stroke-width="0.3" opacity="0.1"/><path d="M25 25h25M25 50v-25" stroke="${finalStatusColor}" stroke-width="0.3" opacity="0.1"/></pattern></defs><rect width="100%" height="100%" fill="url(%23circuit)"/></svg>`;
            const hexGridSvg = `<svg width="100" height="115.47" xmlns="http://www.w3.org/2000/svg"><polygon points="50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87" fill="none" stroke="${finalStatusColor}" stroke-width="0.5" opacity="0.1"/></svg>`;

            // [NEW] GOD-LEVEL BACKGROUND ASSETS
            // 1. Rotating HUD Ring (SVG)
            const hudRingSvg = `<svg width="100%" height="100%" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" style="position:absolute; top:0; left:0; animation: spin-slow 60s linear infinite; pointer-events:none;">
                <circle cx="500" cy="500" r="350" fill="none" stroke="${finalStatusColor}" stroke-width="1" stroke-dasharray="20 40" opacity="0.1"/>
                <circle cx="500" cy="500" r="400" fill="none" stroke="${finalStatusColor}" stroke-width="1" stroke-dasharray="100 100" opacity="0.08"/>
                <circle cx="500" cy="500" r="450" fill="none" stroke="${finalStatusColor}" stroke-width="2" stroke-dasharray="2 10" opacity="0.05"/>
                <path d="M500 50 L500 950 M50 500 L950 500" stroke="${finalStatusColor}" stroke-width="0.5" opacity="0.1"/>
            </svg>`;

            // 1.b [NEW] Holographic Projector Base (SVG)
            const projectorSvg = `<svg width="100%" height="100px" viewBox="0 0 800 100" preserveAspectRatio="none" style="overflow: visible;">
                <defs>
                    <linearGradient id="beamGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="${finalStatusColor}" stop-opacity="0.5" />
                        <stop offset="100%" stop-color="${finalStatusColor}" stop-opacity="0" />
                    </linearGradient>
                </defs>
                <path d="M0 100 L350 100 L400 80 L450 100 L800 100" fill="none" stroke="${finalStatusColor}" stroke-width="2" vector-effect="non-scaling-stroke" filter="drop-shadow(0 0 5px ${finalStatusColor})"/>
                <path d="M350 100 L0 0 M450 100 L800 0" fill="url(#beamGrad)" opacity="0.1" />
            </svg>`;

            // 2. Floating Math Particles (Generated HTML)
            const mathParticles = Array.from({length: 40}, () => {
                const formulas = ['∫f(x)dx', 'e^iπ+1=0', 'E=mc²', '∇×F', '∂²u/∂t²', 'sin²θ+cos²θ=1', 'lim(x→∞)', '∑n=1', 'P(A|B)', 'H(X)', 'Φ(z)', 'λmax'];
                const content = formulas[Math.floor(Math.random() * formulas.length)];
                const left = Math.random() * 100;
                const top = Math.random() * 100;
                const dur = 15 + Math.random() * 20;
                const delay = Math.random() * -20;
                const scale = 0.5 + Math.random() * 0.8;
                return `<div style="position:absolute; left:${left}%; top:${top}%; font-family:'Times New Roman', serif; font-style:italic; animation: floatMath ${dur}s linear infinite; animation-delay: ${delay}s; opacity: 0; transform: scale(${scale}); color:${finalStatusColor}; text-shadow: 0 0 5px ${finalStatusColor}; pointer-events:none;">${content}</div>`;
            }).join('');

            // 3. Binary Data Rain (Generated HTML)
            const binaryRain = Array.from({length: 25}, () => {
                const left = Math.random() * 100;
                const dur = 3 + Math.random() * 5;
                const delay = Math.random() * -5;
                const content = Array.from({length: 15}, () => Math.random() > 0.5 ? '1' : '0').join('<br>');
                return `<div style="position:absolute; left:${left}%; top:-20%; font-family:'Courier New', monospace; font-size:10px; line-height:10px; animation: matrixFall ${dur}s linear infinite; animation-delay: ${delay}s; opacity: 0.08; color:${finalStatusColor}; pointer-events:none;">${content}</div>`;
            }).join('');

            // 4. [NEW] Data Stream Columns (Generated HTML)
            const generateDataStream = (count) => Array.from({length: count}, () => 
                `<div class="data-row">
                    <span style="color:#FFF; opacity:0.8;">0x${Math.random().toString(16).substr(2,4).toUpperCase()}</span> 
                    <span style="opacity:0.5">${Math.random().toString(2).substr(2,8)}</span>
                    <span style="color:${finalStatusColor}; opacity:0.7;">[${Math.random() > 0.5 ? 'OK' : 'VR'}]</span>
                </div>`
            ).join('');
            const leftDataStream = generateDataStream(40);
            const rightDataStream = generateDataStream(40);

            // 5. [NEW] 3D DNA Helix Generator (HTML String)
            const dnaHelixHTML = `
            <div class="dna-iso" style="position: absolute; right: 8%; top: 50%; transform: translateY(-50%); width: 60px; height: 60vh; perspective: 500px; opacity: 0.5; z-index: 0; pointer-events: none;">
                ${Array.from({length: 40}, (_, i) => `
                    <div class="dna-base" style="top: ${i * 15}px; animation-delay: -${i * 0.1}s;">
                        <div class="dot left" style="background: ${finalStatusColor}; box-shadow: 0 0 5px ${finalStatusColor};"></div>
                        <div class="line" style="background: ${finalStatusColor};"></div>
                        <div class="dot right" style="background: ${finalStatusColor}; box-shadow: 0 0 5px ${finalStatusColor};"></div>
                    </div>
                `).join('')}
            </div>
            `;

            // 6. [NEW] Giant Targeting Reticle (SVG)
            const reticleSvg = `
            <svg viewBox="0 0 500 500" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 130vh; height: 130vh; pointer-events: none; z-index: 1; opacity: 0.15;">
                <circle cx="250" cy="250" r="200" fill="none" stroke="${finalStatusColor}" stroke-width="0.5" stroke-dasharray="10 20">
                    <animateTransform attributeName="transform" type="rotate" from="0 250 250" to="360 250 250" dur="60s" repeatCount="indefinite"/>
                </circle>
                <circle cx="250" cy="250" r="150" fill="none" stroke="${finalStatusColor}" stroke-width="0.5" stroke-dasharray="2 10">
                    <animateTransform attributeName="transform" type="rotate" from="360 250 250" to="0 250 250" dur="40s" repeatCount="indefinite"/>
                </circle>
                <path d="M250 20 L250 50 M250 480 L250 450 M20 250 L50 250 M480 250 L450 250" stroke="${finalStatusColor}" stroke-width="2" />
            </svg>
            `;

            // [NEW] ID Card HTML Block
            const idCardHTML = `
                <div class="id-card-container" style="transform-style: preserve-3d; animation: idCardEntry 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.2s; opacity:0;">
                    <div class="id-card-glare"></div>
                    <div class="id-card-bg-layers">
                        <div class="id-card-bg-layer" style="background-image: url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(circuitSvg)}'); opacity: 0.5;"></div>
                        <div class="id-card-bg-layer" style="background-image: url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(hexGridSvg)}'); animation: hex-pan 20s linear infinite;"></div>
                    </div>
                    <div class="id-card-content">
                        <div class="absolute top-28 right-6 w-12 h-9 bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 rounded-md border border-yellow-300/50 shadow-md z-20 overflow-hidden opacity-90">
                            <div class="absolute top-1/2 left-0 w-full h-[1px] bg-black/20"></div>
                            <div class="absolute left-1/3 top-0 w-[1px] h-full bg-black/20"></div>
                            <div class="absolute left-2/3 top-0 w-[1px] h-full bg-black/20"></div>
                            <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-black/10 rounded-sm"></div>
                        </div>
                        <div class="relative h-24 bg-gradient-to-r from-blue-900 to-indigo-900 flex items-center px-6 overflow-hidden">
                            <div class="absolute inset-0 opacity-20" style="background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNmZmZmZmYiLz48L3N2Zz4=');"></div>
                            <div class="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/30 mr-4 shadow-lg backdrop-blur-sm overflow-hidden">
                                <img src="logo.jpg" class="w-full h-full object-cover">
                            </div>
                            <div class="z-10">
                                <h2 class="text-xl font-black text-white tracking-widest uppercase leading-none drop-shadow-md">PUSKESMAS WANA</h2>
                                <p class="text-xs text-white tracking-[0.2em] mt-1 uppercase font-bold drop-shadow-md">Kartu Identitas Pegawai</p>
                            </div>
                            <div class="absolute bottom-0 left-0 w-full h-1 bg-yellow-500"></div>
                        </div>
                        <div class="p-6 flex gap-5 items-start bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48ZyBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDQwaDQwVjBIMHY0MHptMjAgMjBoMjBWMjBIMHYyMHpNNDAgNDBWMjBIMHYyMGg0MHoiIGZpbGw9IiMzMzMiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvZz48L3N2Zz4=')]">
                            <div class="relative w-28 h-36 flex-shrink-0">
                                <div class="w-full h-full rounded-lg overflow-hidden border-2 border-white/20 shadow-xl bg-slate-800">
                                    <img src="${employeeData.foto ? `data:image/jpeg;base64,${employeeData.foto}` : ''}" class="w-full h-full object-cover" onerror="this.style.display='none'">
                                </div>
                                <div class="absolute -bottom-3 -right-3 w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-yellow-200 border-2 border-white shadow-lg flex items-center justify-center opacity-90">
                                    <span class="text-[6px] font-bold text-yellow-900 text-center leading-tight">RESMI<br>VALID</span>
                                </div>
                            </div>
                            <div class="flex-1 flex flex-col justify-between h-36 py-1">
                                <div>
                                    <p class="text-xs text-white uppercase tracking-widest font-black drop-shadow-md mb-1" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">Nama Lengkap</p>
                                    <h1 class="text-2xl font-black text-white leading-none mb-2 drop-shadow-md tracking-tight" style="text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${display_name}</h1>
                                    <p class="text-xs text-white uppercase tracking-widest font-black drop-shadow-md mb-1" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">Jabatan</p>
                                    <p class="text-lg font-bold text-emerald-300 mb-3 drop-shadow-md tracking-wide" style="text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${display_jabatan}</p>
                                </div>
                                <div class="flex justify-between items-end border-t border-white/10 pt-2">
                                    <div>
                                        <p class="text-[9px] text-slate-400 uppercase tracking-wider font-bold">ID Pegawai</p>
                                        <p class="text-sm font-mono text-slate-200 tracking-wide">${karyawanId}</p>
                                    </div>
                                    <div class="flex flex-col items-end gap-1 opacity-90">
                                        <div class="bg-white px-2 py-1 rounded-sm relative overflow-hidden">
                                            <p class="text-black leading-none select-none" style="font-family: 'Libre Barcode 128', cursive; font-size: 34px; transform: scaleY(1.2);">${karyawanId}</p>
                                            <div class="absolute top-0 left-0 w-[1px] h-full bg-red-500/80 shadow-[0_0_4px_rgba(255,0,0,0.8)]" style="animation: barcodeScan 2s linear infinite;"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="h-3 bg-slate-900 border-t border-white/10 flex items-center justify-between px-4">
                            <span class="text-[6px] text-slate-500 tracking-widest">LAYANAN KESEHATAN PEMERINTAH // ID RESMI</span>
                            <span class="text-[6px] text-slate-500 tracking-widest">DOKUMEN AMAN</span>
                        </div>
                    </div>
                </div>
            `;

            successOverlay.style.background = 'radial-gradient(circle at center, rgba(5, 10, 20, 0.98) 0%, #000000 100%)';
            successOverlay.innerHTML = `
                <style>
                    .spotlight {
                        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                        width: 100vw; height: 100vh;
                        background: radial-gradient(ellipse at center, ${finalStatusColor}15 0%, transparent 60%);
                        z-index: 0;
                        pointer-events: none;
                        animation: pulse-spotlight 4s infinite alternate;
                    }
                    @keyframes pulse-spotlight {
                        0% { opacity: 0.3; transform: translate(-50%, -50%) scale(0.8); }
                        100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.2); }
                    }
                    
                    /* GOD-LEVEL ANIMATIONS */
                    @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    @keyframes floatMath { 
                        0% { transform: translateY(0) rotate(0deg); opacity: 0; } 
                        20% { opacity: 0.4; }
                        80% { opacity: 0.4; }
                        100% { transform: translateY(-100px) rotate(20deg); opacity: 0; } 
                    }
                    @keyframes matrixFall { 0% { transform: translateY(0); } 100% { transform: translateY(120vh); } }
                    .perspective-grid {
                        position: absolute; width: 200%; height: 200%; left: -50%; top: -50%;
                        background-image: 
                            linear-gradient(${finalStatusColor}20 1px, transparent 1px),
                            linear-gradient(90deg, ${finalStatusColor}20 1px, transparent 1px);
                        background-size: 60px 60px;
                        transform: perspective(500px) rotateX(60deg);
                        animation: grid-move 20s linear infinite;
                        opacity: 0.3;
                    }
                    @keyframes grid-move { 0% { transform: perspective(500px) rotateX(60deg) translateY(0); } 100% { transform: perspective(500px) rotateX(60deg) translateY(60px); } }

                    /* NEW GOD-LEVEL STYLES */
                    .data-stream-container {
                        position: absolute; top: 0; bottom: 0; width: 180px;
                        display: flex; flex-direction: column; justify-content: center;
                        font-family: 'Share Tech Mono', monospace; font-size: 9px; 
                        color: ${finalStatusColor}; opacity: 0.6; pointer-events: none;
                        overflow: hidden;
                        mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
                        z-index: 5;
                    }
                    .data-stream-left { left: 30px; text-align: left; border-right: 1px solid ${finalStatusColor}33; padding-right: 10px; }
                    .data-stream-right { right: 30px; text-align: right; border-left: 1px solid ${finalStatusColor}33; padding-left: 10px; }
                    .data-row { animation: dataScroll 30s linear infinite; white-space: nowrap; margin-bottom: 2px; }
                    
                    @keyframes dataScroll { from { transform: translateY(0); } to { transform: translateY(-50%); } }
                    
                    .holo-projector {
                        position: absolute; bottom: 0; left: 0; width: 100%; height: 150px;
                        z-index: 5; opacity: 0.8; pointer-events: none;
                    }
                    
                    .analysis-panel {
                        position: absolute; top: 40px; left: 50%; transform: translateX(-50%);
                        width: 600px; height: 60px;
                        display: flex; justify-content: space-between; align-items: center;
                        border-bottom: 1px solid ${finalStatusColor}44;
                        color: ${finalStatusColor}; font-family: 'Rajdhani', sans-serif;
                        z-index: 20;
                        background: linear-gradient(90deg, transparent, ${finalStatusColor}11, transparent);
                    }
                    .stat-block { text-align: center; position: relative; }
                    .stat-block::after { content:''; position:absolute; bottom:-5px; left:50%; transform:translateX(-50%); width:40%; height:2px; background:${finalStatusColor}; }
                    .stat-val { font-size: 24px; font-weight: 900; text-shadow: 0 0 10px ${finalStatusColor}; }
                    .stat-label { font-size: 10px; letter-spacing: 3px; opacity: 0.7; margin-top: 2px; }

                    /* DNA HELIX STYLES */
                    .dna-base {
                        position: absolute; width: 100%; height: 2px;
                        transform-style: preserve-3d;
                        animation: dna-spin 4s linear infinite;
                    }
                    .dna-base .dot { position: absolute; width: 4px; height: 4px; border-radius: 50%; top: -1px; }
                    .dna-base .dot.left { left: 0; }
                    .dna-base .dot.right { right: 0; }
                    .dna-base .line { position: absolute; left: 2px; right: 2px; height: 1px; opacity: 0.3; }
                    @keyframes dna-spin {
                        0% { transform: rotateY(0deg); opacity: 0.3; }
                        50% { opacity: 1; }
                        100% { transform: rotateY(360deg); opacity: 0.3; }
                    }

                    /* --- HIGH-TECH STAMP & CARD STYLES --- */
                    .academic-stamp {
                        position: relative;
                        width: 450px;
                        padding: 20px;
                        border: 1px solid ${finalStatusColor}80;
                        font-family: 'Georgia', serif;
                        color: #FFF;
                        box-shadow: 0 0 30px ${finalStatusColor}40, inset 0 0 10px ${finalStatusColor}20;
                        overflow: hidden;
                        transform: translateY(-600px) scale(2);
                        opacity: 0;
                        animation: stampDescend 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards 1.2s;
                        background: linear-gradient(145deg, rgba(10, 15, 25, 0.95), rgba(5, 8, 12, 0.98));
                    }
                    .guilloche-bg {
                        position: absolute; inset: 0;
                        background-image: url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(guillocheSvg)}');
                        background-size: 100px 100px;
                        z-index: 1;
                    }
                    .watermark-bg {
                        position: absolute; inset: 0;
                        background-image: url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(watermarkSvg)}');
                        background-position: center;
                        animation: watermark-glitch 8s infinite step-end;
                        background-repeat: no-repeat;
                        z-index: 2;
                    }
                    .stamp-content {
                        position: relative;
                        z-index: 3;
                        border: 8px double ${finalStatusColor}CC;
                        padding: 15px;
                        text-align: center;
                    }
                    .stamp-header {
                        display: flex; align-items: center; justify-content: center;
                        gap: 15px; padding-bottom: 10px;
                        border-bottom: 1px solid ${finalStatusColor}80;
                    }
                    .emblem {
                        width: 60px; height: 60px; border-radius: 50%;
                        border: 2px solid ${finalStatusColor}; padding: 4px; background: #000;
                    }
                    .emblem img { width: 100%; height: 100%; object-fit: contain; border-radius: 50%; }
                    .emblem-text { text-align: left; }
                    .emblem-text span { display: block; text-transform: uppercase; font-weight: 900; background: linear-gradient(to bottom, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.9)); border-bottom: 4px double ${finalStatusColor}; padding-bottom: 2px; }
                    .emblem-text span { font-size: 24px; letter-spacing: 1px; }
                    .stamp-status {
                        font-size: 3rem; font-weight: 900; letter-spacing: 2px;
                        text-transform: uppercase; color: ${finalStatusColor};
                        text-shadow: 0 0 10px ${finalStatusColor}, 0 0 20px ${finalStatusColor}, 0 0 40px ${finalStatusColor}; margin: 15px 0; line-height: 1;
                    }
                    .stamp-details {
                        font-size: 12px; color: #DDD;
                        border-top: 1px solid ${finalStatusColor}80;
                        border-bottom: 1px solid ${finalStatusColor}80;
                        padding: 10px 0; margin-bottom: 15px;
                    }
                    .stamp-details > div { display: flex; justify-content: space-between; padding: 2px 5px; }
                    .stamp-details > div span:first-child { font-weight: bold; opacity: 0.8; }
                    .stamp-footer {
                        font-family: 'Courier New', monospace; font-size: 10px;
                        background: #000; padding: 5px; border: 1px solid ${finalStatusColor}50;
                        word-break: break-all; color: ${finalStatusColor};
                    }
                    
                    /* --- ID CARD STYLES --- */
                    .id-card-container {
                        width: 420px;
                        position: relative;
                        perspective: 1500px;
                    }
                    .id-card-content {
                        background: linear-gradient(135deg, rgba(15, 25, 40, 0.9), rgba(5, 10, 20, 0.95));
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 12px;
                        box-shadow: 0 20px 50px rgba(0,0,0,0.8);
                        backdrop-filter: blur(15px);
                        transform-style: preserve-3d;
                        font-family: 'Rajdhani', sans-serif;
                        overflow: hidden;
                    }
                    .id-card-bg-layers {
                        position: absolute; inset: 0; border-radius: 12px; overflow: hidden;
                    }
                    .id-card-bg-layer {
                        position: absolute; inset: 0;
                        background-size: cover;
                    }
                    .id-card-glare {
                        position: absolute; inset: 0; border-radius: 12px;
                        background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.15) 50%, transparent 70%);
                        background-size: 300% 100%;
                        animation: card-glare 5s linear infinite;
                        z-index: 15;
                    }

                    /* --- ANIMATIONS --- */
                    @keyframes idCardEntry {
                        0% { opacity: 0; transform: translateX(-150px) rotateY(-360deg) scale(0.5); }
                        100% { opacity: 1; transform: translateX(0) rotateY(0deg) scale(1); }
                    }
                    @keyframes stampDescend {
                        from { opacity: 0; transform: translateY(-100px) rotateX(-30deg) scale(0.9); }
                        to { opacity: 1; transform: translateY(0) rotateX(0deg) scale(1); }
                    }
                    @keyframes barcodeScan {
                        0% { left: 0%; opacity: 0; }
                        10% { opacity: 1; }
                        90% { opacity: 1; }
                        100% { left: 100%; opacity: 0; }
                    }
                    @keyframes hex-pan {
                        from { transform: translateY(0) rotate(0deg); }
                        to { transform: translateY(-57.735px) rotate(60deg); }
                    }
                    @keyframes card-glare {
                        from { background-position: 200% 0; }
                        to { background-position: -200% 0; }
                    }
                    @keyframes watermark-glitch {
                        0%, 100% { opacity: 0.06; transform: rotate(-45deg) translate(0,0); }
                        49% { opacity: 0.06; transform: rotate(-45deg) translate(0,0); }
                        50% { opacity: 0.02; transform: rotate(-45deg) translate(2px, -2px); }
                        51% { opacity: 0.06; transform: rotate(-45deg) translate(0,0); }
                    }

                    /* --- 3D HYPER-TECH SHUTTER STYLES (GOD TIER) --- */
                    .shutter-layer {
                        position: absolute; inset: 0; z-index: 9999;
                        display: flex; pointer-events: none;
                        perspective: 1500px; overflow: hidden;
                    }
                    .shutter-panel {
                        flex: 1; 
                        background: 
                            radial-gradient(circle at 30% 30%, rgba(255,255,255,0.05) 0%, transparent 20%), /* Specular highlight */
                            repeating-linear-gradient(90deg, #1a1a1a 0, #1a1a1a 2px, #111 2px, #111 4px), /* Brushed Metal Texture */
                            linear-gradient(to bottom, #2c3e50 0%, #000 100%); /* Base Gradient */
                        position: relative;
                        transition: transform 0.6s cubic-bezier(0.6, -0.28, 0.735, 0.045); /* Mechanical Retract */
                        border-top: 1px solid ${finalStatusColor}33;
                        border-bottom: 1px solid ${finalStatusColor}33;
                        display: flex; flex-direction: column; justify-content: center;
                        box-shadow: inset 0 0 150px #000;
                        overflow: hidden;
                        will-change: transform;
                    }
                    .shutter-left { 
                        transform-origin: left center; 
                        border-right: 4px solid #000; 
                        box-shadow: inset -10px 0 20px rgba(0,0,0,0.8), 5px 0 15px rgba(0,0,0,0.5);
                        z-index: 2;
                    }
                    .shutter-right { 
                        transform-origin: right center; 
                        border-left: 4px solid #000; 
                        box-shadow: inset 10px 0 20px rgba(0,0,0,0.8), -5px 0 15px rgba(0,0,0,0.5);
                        z-index: 2;
                    }
                    
                    /* HYPER-MECHANICAL BOLTS (Kunci Pintu) */
                    .mech-bolt {
                        position: absolute; width: 120px; height: 40px;
                        background: linear-gradient(to bottom, #333, #777, #333); /* Metallic Cylinder */
                        border: 1px solid ${finalStatusColor}66;
                        box-shadow: 0 0 5px #000, inset 0 1px 0 rgba(255,255,255,0.3);
                        z-index: 20;
                        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Springy retract */
                        display: flex; align-items: center; justify-content: center;
                    }
                    .mech-bolt::after {
                        content: ''; width: 80%; height: 4px; background: ${finalStatusColor};
                        box-shadow: 0 0 10px ${finalStatusColor}; border-radius: 2px;
                    }
                    
                    .shutter-left .mech-bolt { right: -20px; border-radius: 4px 0 0 4px; border-right: none; }
                    .shutter-right .mech-bolt { left: -20px; border-radius: 0 4px 4px 0; border-left: none; }
                    
                    .bolt-top { top: 30%; }
                    .bolt-bottom { bottom: 30%; }

                    /* RETRACT ANIMATION FOR BOLTS */
                    .shutter-crack .shutter-left .mech-bolt { transform: translateX(-110px); }
                    .shutter-crack .shutter-right .mech-bolt { transform: translateX(110px); }

                    .shutter-data {
                        position: absolute; top: 50%; width: 100%; transform: translateY(-50%);
                        font-family: 'Rajdhani', sans-serif; font-size: 65px; 
                        font-weight: 900;
                        text-align: center; pointer-events: none; user-select: none;
                        white-space: nowrap; overflow: hidden;
                        letter-spacing: 0.15em;
                        /* Gold Inlay Effect (Kesan Barang Berharga) */
                        background: linear-gradient(to bottom, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C);
                        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                        filter: drop-shadow(0 2px 5px rgba(0,0,0,0.8)); opacity: 0.9;
                    }

                    /* GOD-TIER LOCK MECHANISM */
                    .shutter-lock {
                        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                        width: 280px; height: 280px; 
                        display: flex; align-items: center; justify-content: center; z-index: 10000;
                        perspective: 1000px;
                        transition: all 0.5s cubic-bezier(0.6, -0.28, 0.735, 0.045);
                    }
                    
                    /* KINETIC RINGS (Cincin Berputar) */
                    .lock-ring {
                        position: absolute; border-radius: 50%;
                        box-shadow: 0 0 15px ${finalStatusColor}22;
                    }
                    .ring-1 { /* Outer Dashed */
                        width: 100%; height: 100%;
                        border: 2px dashed ${finalStatusColor}66;
                        animation: spin-slow 20s linear infinite;
                    }
                    .ring-2 { /* Middle Tech */
                        width: 82%; height: 82%;
                        border: 1px solid ${finalStatusColor}44;
                        border-top: 4px solid ${finalStatusColor};
                        border-bottom: 4px solid ${finalStatusColor};
                        animation: spin-reverse 8s linear infinite;
                    }
                    .ring-3 { /* Inner Fast */
                        width: 65%; height: 65%;
                        border: 2px solid transparent;
                        border-left: 4px solid ${finalStatusColor};
                        border-right: 4px solid ${finalStatusColor};
                        animation: spin-fast 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    }
                    .ring-4 { /* Particle Field */
                        width: 120%; height: 120%; border: none; box-shadow: none;
                        background: conic-gradient(from 0deg, transparent 0%, ${finalStatusColor}11 5%, transparent 10%);
                        mask-image: radial-gradient(transparent 60%, black 70%);
                        animation: spin-slow 10s linear infinite reverse;
                    }

                    /* CORE (Inti Gembok) */
                    .lock-core {
                        width: 130px; height: 130px; background: radial-gradient(circle at 30% 30%, #2a2a2a, #000);
                        border: 2px solid ${finalStatusColor};
                        border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        box-shadow: 0 0 60px ${finalStatusColor}66, inset 0 0 40px #000;
                        position: relative; z-index: 2;
                        overflow: hidden;
                    }
                    .core-glare {
                        position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
                        background: linear-gradient(45deg, transparent 45%, rgba(255,255,255,0.1) 50%, transparent 55%);
                        animation: glare-pass 3s infinite;
                    }
                    .lock-scan-line {
                        position: absolute; width: 100%; height: 2px; background: ${finalStatusColor};
                        box-shadow: 0 0 10px ${finalStatusColor};
                        animation: scan-lock 2s ease-in-out infinite; opacity: 0.8;
                    }
                    
                    /* UNLOCK ANIMATION */
                    .shutter-crack .shutter-lock {
                        transform: translate(-50%, -50%) scale(1.8) rotate(90deg);
                        opacity: 0; filter: blur(30px);
                    }
                    .shutter-crack .lock-core {
                        background: ${finalStatusColor};
                        box-shadow: 0 0 150px ${finalStatusColor}, inset 0 0 50px #fff;
                    }
                    .shutter-crack .lock-icon-svg { 
                        stroke: #000; fill: #000; transform: scale(0.8); 
                    }
                    
                    .lock-icon-svg { 
                        width: 60px; height: 60px; 
                        fill: none; stroke: ${finalStatusColor}; stroke-width: 2;
                        stroke-linecap: round; stroke-linejoin: round;
                        filter: drop-shadow(0 0 10px ${finalStatusColor});
                        transition: all 0.3s;
                    }

                    @keyframes spin-fast { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    @keyframes spin-reverse { 0% { transform: rotate(360deg); } 100% { transform: rotate(0deg); } }
                    @keyframes glare-pass { 0% { transform: translate(-20%, -20%) rotate(45deg); } 100% { transform: translate(20%, 20%) rotate(45deg); } }
                    @keyframes scan-lock { 0%, 100% { top: 10%; opacity: 0; } 50% { top: 90%; opacity: 1; } }
                    
                    /* TEASE STATE (Sedikit Terbuka - Mengintip) */
                    .shutter-crack .shutter-left { transform: translateX(-40px); }
                    .shutter-crack .shutter-right { transform: translateX(40px); }

                    /* OPEN STATE ANIMATION (Heavy Slide) */
                    .shutter-open .shutter-panel {
                        transition: transform 2.5s cubic-bezier(0.2, 0.6, 0.3, 1); /* Heavy Industrial Slide */
                    }
                    .shutter-open .shutter-left { 
                        transform: translateX(-105%); /* Slide fully off-screen left */
                        box-shadow: none;
                    }
                    .shutter-open .shutter-right { 
                        transform: translateX(105%); /* Slide fully off-screen right */
                        box-shadow: none;
                    }

                    /* ENERGY FLASH ON OPEN */
                    .energy-flash {
                        position: absolute; top: 0; left: 50%; width: 2px; height: 100%;
                        background: #fff;
                        box-shadow: 0 0 50px #fff, 0 0 100px ${finalStatusColor};
                        z-index: 999; opacity: 0;
                        transform: translateX(-50%);
                    }
                    .shutter-crack .energy-flash {
                        animation: flash-burst 0.3s ease-out forwards 0.3s;
                    }
                    @keyframes flash-burst {
                        0% { opacity: 0; width: 2px; }
                        50% { opacity: 1; width: 100px; }
                        100% { opacity: 0; width: 200vw; }
                    }
                </style>

                <!-- 3D SHUTTER CURTAIN (Overlay on top) -->
                <div id="cyber-shutter" class="shutter-layer">
                    <div class="energy-flash"></div>
                    
                    <div class="shutter-panel shutter-left">
                        <div class="mech-bolt bolt-top"></div>
                        <div class="mech-bolt bolt-bottom"></div>
                        <div class="shutter-data">PUSKESMAS</div>
                    </div>
                    
                    <div class="shutter-panel shutter-right">
                        <div class="mech-bolt bolt-top"></div>
                        <div class="mech-bolt bolt-bottom"></div>
                        <div class="shutter-data">WANA</div>
                    </div>
                    
                    <div class="shutter-lock">
                        <div class="lock-ring ring-4"></div>
                        <div class="lock-ring ring-1"></div>
                        <div class="lock-ring ring-2"></div>
                        <div class="lock-ring ring-3"></div>
                        <div class="lock-core">
                            <div class="core-glare"></div>
                            <div class="lock-scan-line"></div>
                            <svg class="lock-icon-svg" viewBox="0 0 24 24">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- GOD-LEVEL BACKGROUND LAYERS -->
                <div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none;">
                    <div class="perspective-grid"></div>
                    ${hudRingSvg}
                    ${mathParticles}
                    ${binaryRain}
                    ${reticleSvg}
                    ${dnaHelixHTML}
                    
                    <!-- NEW: Data Streams -->
                    <div class="data-stream-container data-stream-left">
                        <div style="margin-bottom:10px; font-weight:bold; border-bottom:1px solid ${finalStatusColor};">MEMORY_DUMP_SEG_01</div>
                        ${leftDataStream}
                        ${leftDataStream} <!-- Duplicate for loop -->
                    </div>
                    <div class="data-stream-container data-stream-right">
                        <div style="margin-bottom:10px; font-weight:bold; border-bottom:1px solid ${finalStatusColor};">NET_PACKET_TRACE</div>
                        ${rightDataStream}
                        ${rightDataStream} <!-- Duplicate for loop -->
                    </div>
                    
                    <!-- NEW: Projector Base -->
                    <div class="holo-projector">${projectorSvg}</div>
                    
                    <div class="spotlight"></div>
                </div>

                <!-- NEW: Top Analysis Panel -->
                <div class="analysis-panel">
                    <div class="stat-block"><div class="stat-val">99.9%</div><div class="stat-label">MATCH ACCURACY</div></div>
                    <div class="stat-block"><div class="stat-val">${Math.floor(Math.random()*50+20)}ms</div><div class="stat-label">LATENCY</div></div>
                    <div class="stat-block"><div class="stat-val">SECURE</div><div class="stat-label">CONNECTION</div></div>
                </div>

                <div class="holographic-container" style="perspective: 2000px; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; position: relative; z-index: 10;">
                <div style="display: flex; justify-content: center; align-items: center; gap: 100px; width: 100%; transform-style: preserve-3d;">
                    <!-- Kolom Kiri: ID Card -->
                    <div style="transform: translateZ(20px);">
                        ${idCardHTML}
                    </div>

                    <!-- Kolom Kanan: Stempel Akademik -->
                    <div class="academic-stamp" style="transform: translateZ(60px);">
                        <div class="guilloche-bg"></div>
                        <div class="watermark-bg"></div>
                        <div class="stamp-content">
                            <div class="stamp-header">
                                <div class="emblem">
                                    <img src="logo.jpg" alt="Logo" onerror="this.style.display='none'">
                                </div>
                                <div class="emblem-text">
                                    <span>UPTD Puskesmas Wana</span>
                                </div>
                            </div>
                            <div class="stamp-status">
                                ${!result.success ? 'AKSES DITOLAK' : (result.telat_menit > 0 ? `TERLAMBAT<div style='font-size: 1rem; letter-spacing: 4px; margin-top: 5px;'>+${result.telat_menit} MENIT</div>` : 'AKSES DITERIMA')}
                            </div>
                            <div class="stamp-details">
                                <div><span>Nama Pegawai</span><span>${display_name}</span></div>
                                <div><span>Tanggal Verifikasi</span><span>${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
                                <div><span>Waktu Verifikasi</span><span>${serverTimestamp}</span></div>
                                <div><span>Petugas Sistem</span><span>AETHER BIOMETRIC v4.5</span></div>
                            </div>
                            <div class="stamp-footer">
                                <div style="font-size: 8px; opacity: 0.7; margin-bottom: 2px;">Kunci Validasi Digital (SHA-256)</div>
                                <div id="validation-hash">GENERATING...</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Cooldown Bar (Keep this for UX) -->
                <div class="cooldown-track" style="position: fixed; bottom: 0; left: 0; z-index: 100;"><div id="cooldownBar" class="cooldown-progress" style="background: ${finalStatusColor}; box-shadow: 0 0 20px ${finalStatusColor};"></div></div>
            `;

            // [NEW] Parallax Mouse Move Effect
            const container = successOverlay.querySelector('.holographic-container > div');
            if (container) {
                successOverlay.onmousemove = (e) => {
                    const rect = container.getBoundingClientRect();
                    const x = e.clientX - rect.left - rect.width / 2;
                    const y = e.clientY - rect.top - rect.height / 2;
                    const rotateY = -x / 40; // Sensitivitas
                    const rotateX = y / 40;
                    container.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
                };
            }

            // Trigger Shutter Open Animation (Sequence: Tease -> Surprise)
            setTimeout(() => {
                const shutter = document.getElementById('cyber-shutter');
                if(shutter) {
                    // Fase 1: Membuka sedikit (Bikin Penasaran)
                    shutter.classList.add('shutter-crack');
                    SoundFX.play('shutter_crack'); // [NEW] Trigger Suara Kunci
                    
                    // Fase 2: Membuka Cepat (Surprise!)
                    setTimeout(() => {
                        shutter.classList.add('shutter-open');
                        SoundFX.play('shutter_open'); // [NEW] Trigger Suara Geser
                    }, 1200);
                }
            }, 200);

            // Animate hash
            animateHash('validation-hash');

            // Trigger Screen Shake on Stamp Impact (Sync with CSS animation delay 1.2s + duration 0.4s)
            setTimeout(() => {
                triggerScreenFlash(finalStatusColor); // Flash dipindah ke saat Impact (Stempel Menghantam)
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
                        <span class="text-red-500 font-bold tracking-[0.3em] text-2xl">PERINGATAN SISTEM</span>
                    </div>
                    <div class="p-20 text-center flex flex-col items-center justify-center h-full">
                        <h1 class="text-6xl font-black text-red-500 mb-8 glitch-text">TRANSMISI GAGAL</h1>
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
        
        // [FIX] Reset Recognition State & Buffers (Mencegah Ghosting/Data Lama Muncul)
        recognitionHistory = [];
        lastStableResult = null;
        lockGraceCounter = 0;
        lastKnownMatch = null;
        targetLabel = '';
        confidenceHistory = [];
        isTargetLocked = false;
        resetTargetData(); // Reset UI Teks

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
        console.log('Opening Admin Panel...');
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
        // Professional Dark Void Background (Transparan untuk CSS)
        scene.clearColor = new BABYLON.Color4(0.0, 0.0, 0.0, 0.0); 
        
        // Fog for depth (Memberikan kedalaman ruang)
        scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
        scene.fogDensity = 0.02;
        scene.fogColor = new BABYLON.Color3(0.0, 0.0, 0.0);

        // Camera - Fixed angle, professional view
        const camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI / 2, Math.PI / 2.2, 25, BABYLON.Vector3.Zero(), scene);
        camera.wheelPrecision = 50;
        
        // Lighting
        const light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
        light1.intensity = 0.3;
        const light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(0, 0, 0), scene);
        light2.intensity = 1.0;
        light2.diffuse = new BABYLON.Color3(0, 1, 1); // Cyan light

        // Glow Layer (Essential for Sci-Fi look)
        const gl = new BABYLON.GlowLayer("glow", scene, {
            blurKernelSize: 64 // Blur lebih halus
        });
        gl.intensity = 1.5; // Default intensity

        // --- 1. CENTRAL NEURAL CORE (Abstract Brain/Server) ---
        const corePivot = new BABYLON.TransformNode("corePivot", scene);
        
        // A. Inner Nucleus (Solid Dark)
        const nucleus = BABYLON.MeshBuilder.CreateSphere("nucleus", {diameter: 5, segments: 32}, scene);
        nucleus.parent = corePivot;
        const nMat = new BABYLON.StandardMaterial("nMat", scene);
        nMat.emissiveColor = new BABYLON.Color3(0.0, 0.05, 0.1);
        nMat.disableLighting = true;
        nucleus.material = nMat;

        // B. Wireframe Shell (IcoSphere - Network Structure)
        const shell = BABYLON.MeshBuilder.CreateIcoSphere("shell", {radius: 5.2, subdivisions: 2}, scene);
        shell.parent = corePivot;
        const sMat = new BABYLON.StandardMaterial("sMat", scene);
        sMat.wireframe = true;
        sMat.emissiveColor = new BABYLON.Color3(0, 0.8, 1); // Cyan
        shell.material = sMat;

        // C. Orbital Data Rings (Gyroscope effect)
        const createRing = (radius, angleX, angleZ, speed) => {
            const ring = BABYLON.MeshBuilder.CreateTorus("ring", {diameter: radius, thickness: 0.05, tessellation: 64}, scene);
            ring.parent = corePivot;
            ring.rotation.x = angleX;
            ring.rotation.z = angleZ;
            const rMat = new BABYLON.StandardMaterial("rMat", scene);
            rMat.emissiveColor = new BABYLON.Color3(0.0, 0.3, 0.7);
            ring.material = rMat;
            return { mesh: ring, speed: speed };
        };

        const rings = [
            createRing(12, Math.PI / 2.5, 0, 0.01),
            createRing(14, 0, Math.PI / 3, -0.008),
            createRing(16, Math.PI / 4, Math.PI / 4, 0.005)
        ];

        // --- 2. FLOATING DATA NODES (Constellation) ---
        const nodeCount = 60;
        const nodes = [];
        const nodeMaster = BABYLON.MeshBuilder.CreateSphere("nodeM", {diameter: 0.2}, scene);
        nodeMaster.isVisible = false;
        const nodeMat = new BABYLON.StandardMaterial("nodeMat", scene);
        nodeMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        nodeMaster.material = nodeMat;

        for(let i=0; i<nodeCount; i++) {
            const n = nodeMaster.createInstance("n"+i);
            const angle = Math.random() * Math.PI * 2;
            const height = (Math.random() - 0.5) * 25;
            const radius = 8 + Math.random() * 20;
            
            n.position = new BABYLON.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
            nodes.push({
                mesh: n,
                angle: angle,
                radius: radius,
                speed: (Math.random() * 0.005) + 0.002,
                yBase: height,
                ySpeed: Math.random() * 0.02
            });
        }

        // --- 3. DIGITAL FLOOR GRID (Infinite Plane Effect) ---
        const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 200, height: 200, subdivisions: 40}, scene);
        ground.position.y = -15;
        const gMat = new BABYLON.StandardMaterial("gMat", scene);
        gMat.wireframe = true;
        gMat.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.15);
        gMat.alpha = 0.15;
        ground.material = gMat;

        // --- 4. PARTICLE SYSTEM (Upward Data Flow) ---
        const ps = new BABYLON.ParticleSystem("ps", 2000, scene);
        ps.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);
        ps.emitter = new BABYLON.Vector3(0, -20, 0);
        ps.minEmitBox = new BABYLON.Vector3(-50, 0, -50);
        ps.maxEmitBox = new BABYLON.Vector3(50, 0, 50);
        ps.color1 = new BABYLON.Color4(0, 1, 1, 0.5);
        ps.color2 = new BABYLON.Color4(0, 0.1, 0.3, 0.0);
        ps.minSize = 0.1; ps.maxSize = 0.3;
        ps.minLifeTime = 2; ps.maxLifeTime = 5;
        ps.emitRate = 300;
        ps.gravity = new BABYLON.Vector3(0, 3, 0);
        ps.start();

        // --- MOUSE INTERACTION ---
        let mouseX = 0, mouseY = 0;
        window.addEventListener('mousemove', (e) => {
            mouseX = (e.clientX / window.innerWidth) - 0.5;
            mouseY = (e.clientY / window.innerHeight) - 0.5;
        });

        let time = 0;
        scene.registerBeforeRender(() => {
            time += 0.01;

            // Core Animation
            corePivot.rotation.y += 0.005;
            shell.rotation.z -= 0.002;
            shell.rotation.x += 0.001;
            
            // Rings
            rings.forEach(r => {
                r.mesh.rotation.y += r.speed;
                r.mesh.rotation.x += r.speed * 0.5;
            });

            // Nodes Orbit
            nodes.forEach(n => {
                n.angle += n.speed;
                n.mesh.position.x = Math.cos(n.angle) * n.radius;
                n.mesh.position.z = Math.sin(n.angle) * n.radius;
                n.mesh.position.y = n.yBase + Math.sin(time + n.angle) * 1;
            });

            // Mouse Parallax
            camera.alpha += ((-Math.PI / 2 + (mouseX * 0.5)) - camera.alpha) * 0.05;
            camera.beta += ((Math.PI / 2.2 + (mouseY * 0.2)) - camera.beta) * 0.05;
        });
        
        // --- H. DYNAMIC THEME CONTROLLER (NEW) ---
        // Fungsi ini dipanggil oleh setSystemTheme() untuk mengubah warna dunia 3D
        window.update3DTheme = (status) => {
            let targetColor = new BABYLON.Color3(0, 1, 1); // Default Cyan
            if (status === 'SUCCESS') targetColor = new BABYLON.Color3(0, 1, 0.3); // Green
            if (status === 'ERROR') targetColor = new BABYLON.Color3(1, 0, 0.2); // Red
            
            // Animate Color Change
            BABYLON.Animation.CreateAndStartAnimation("color", sMat, "emissiveColor", 30, 30, sMat.emissiveColor, targetColor, 0);
            light2.diffuse = targetColor;
            ps.color1 = new BABYLON.Color4(targetColor.r, targetColor.g, targetColor.b, 0.5);
        };
        
        return scene;
    };

    const scene = createScene();
    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
}

// --- FITUR BARU: INJECT AMBULANCE DISPLAY (REQUESTED) ---
function injectAmbulanceDisplay() {
    // MODIFIKASI: Target Panel Device Select (Media Device) agar posisi di kiri atas
    const cameraSelect = document.getElementById('cameraSelect');
    const targetPanel = cameraSelect ? cameraSelect.closest('.widget-panel') : null;

    // Cek jika panel ada dan belum di-inject
    if (targetPanel && !document.getElementById('ambulance-unit-display')) {
        const wrapper = document.createElement('div');
        wrapper.id = 'ambulance-unit-display';
        // Styling futuristik agar senada dengan UI
        wrapper.style.marginTop = '10px'; 
        wrapper.style.marginBottom = '15px';
        wrapper.style.border = '1px solid #00FFFF';
        wrapper.style.borderRadius = '6px';
        wrapper.style.overflow = 'hidden';
        wrapper.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.2)';
        wrapper.style.position = 'relative';
        wrapper.style.background = 'rgba(0, 20, 30, 0.6)';

        wrapper.innerHTML = `
            <div style="position: relative;">
                <img src="AMBULAN.jpeg" style="width: 100%; height: auto; display: block; opacity: 0.9; filter: contrast(1.1);">
                
                <!-- UNDERGLOW (Neon Bawah Mobil) -->
                <div style="position: absolute; bottom: 2%; left: 10%; width: 80%; height: 20%; background: radial-gradient(ellipse at center, rgba(0, 255, 255, 0.6) 0%, transparent 70%); filter: blur(20px); opacity: 0.6; animation: underglow-pulse 3s infinite; z-index: 0;"></div>

                <!-- ROAD REFLECTIONS (Pantulan Strobo) -->
                <div style="position: absolute; bottom: 5%; left: 20%; width: 25%; height: 10%; background: radial-gradient(ellipse at center, rgba(0, 0, 255, 0.6) 0%, transparent 80%); filter: blur(15px); mix-blend-mode: screen; animation: strobe-blue 0.6s infinite; z-index: 1;"></div>
                <div style="position: absolute; bottom: 5%; left: 37.5%; width: 25%; height: 10%; background: radial-gradient(ellipse at center, rgba(255, 215, 0, 0.6) 0%, transparent 80%); filter: blur(15px); mix-blend-mode: screen; animation: strobe-yellow 0.6s infinite; z-index: 1;"></div>
                <div style="position: absolute; bottom: 5%; right: 20%; width: 25%; height: 10%; background: radial-gradient(ellipse at center, rgba(255, 0, 0, 0.6) 0%, transparent 80%); filter: blur(15px); mix-blend-mode: screen; animation: strobe-red 0.6s infinite; z-index: 1;"></div>
                <div style="position: absolute; bottom: 4%; left: 35%; width: 30%; height: 8%; background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.5) 0%, transparent 80%); filter: blur(10px); mix-blend-mode: screen; animation: grill-flash 0.15s infinite; z-index: 1;"></div>

                <!-- SIREN LIGHTS (Strobo: Biru-Kuning-Merah Bergantian) -->
                <div style="position: absolute; top: 14%; left: 28%; width: 14%; height: 14%; border-radius: 50%; filter: blur(15px); mix-blend-mode: screen; background: rgba(0, 0, 255, 0.9); box-shadow: 0 0 50px rgba(0, 0, 255, 1); animation: strobe-blue 0.6s infinite;"></div>
                <div style="position: absolute; top: 12%; left: 43%; width: 14%; height: 14%; border-radius: 50%; filter: blur(15px); mix-blend-mode: screen; background: rgba(255, 215, 0, 0.9); box-shadow: 0 0 50px rgba(255, 215, 0, 1); animation: strobe-yellow 0.6s infinite;"></div>
                <div style="position: absolute; top: 14%; right: 28%; width: 14%; height: 14%; border-radius: 50%; filter: blur(15px); mix-blend-mode: screen; background: rgba(255, 0, 0, 0.9); box-shadow: 0 0 50px rgba(255, 0, 0, 1); animation: strobe-red 0.6s infinite;"></div>

                <!-- HEADLIGHTS (Wig-Wag Putih) -->
                <div style="position: absolute; top: 52%; left: 12%; width: 18%; height: 12%; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,1) 20%, rgba(255,255,255,0) 70%); mix-blend-mode: screen; filter: blur(5px); opacity: 0; animation: headlight-wigwag-left 0.6s infinite;"></div>
                <div style="position: absolute; top: 52%; right: 12%; width: 18%; height: 12%; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,1) 20%, rgba(255,255,255,0) 70%); mix-blend-mode: screen; filter: blur(5px); opacity: 0; animation: headlight-wigwag-right 0.6s infinite;"></div>

                <!-- GRILL STROBES (Lampu Kompoi Depan) -->
                <div style="position: absolute; top: 45%; left: 42%; width: 6%; height: 3%; background: rgba(255, 255, 255, 1); box-shadow: 0 0 20px rgba(255, 255, 255, 1); border-radius: 2px; animation: grill-flash 0.15s infinite;"></div>
                <div style="position: absolute; top: 47%; right: 42%; width: 6%; height: 3%; background: rgba(255, 255, 255, 1); box-shadow: 0 0 20px rgba(255, 255, 255, 1); border-radius: 2px; animation: grill-flash 0.15s infinite 0.07s;"></div>
                <div style="position: absolute; top: 47%; left: 42%; width: 6%; height: 3%; background: rgba(255, 255, 255, 1); box-shadow: 0 0 20px rgba(255, 255, 255, 1); border-radius: 2px; animation: grill-flash 0.15s infinite;"></div>
                <div style="position: absolute; top: 47%; right: 42%; width: 6%; height: 3%; background: rgba(255, 255, 255, 1); box-shadow: 0 0 20px rgba(255, 255, 255, 1); border-radius: 2px; animation: grill-flash 0.15s infinite 0.07s;"></div>

                <!-- HUD TELEMETRY (Data Teknis) -->
                <div style="position: absolute; top: 5%; right: 5%; text-align: right; z-index: 10;">
                    <div style="color: #00FFFF; font-size: 9px; font-family: 'Courier New'; font-weight: bold; text-shadow: 0 0 5px #00FFFF; margin-bottom: 2px;">ENGINE: <span style="color: #00FF7F; animation: blink 2s infinite;">IDLE</span></div>
                    <div style="color: #00FFFF; font-size: 9px; font-family: 'Courier New'; font-weight: bold; text-shadow: 0 0 5px #00FFFF; margin-bottom: 2px;">GPS: <span style="color: #00FF7F;">LOCKED</span></div>
                    <div style="color: #00FFFF; font-size: 9px; font-family: 'Courier New'; font-weight: bold; text-shadow: 0 0 5px #00FFFF;">FUEL: <span style="color: #00FF7F;">98%</span></div>
                </div>

                <!-- WINDSHIELD REFLECTION (Kilatan Kaca) -->
                <div style="position: absolute; top: 15%; left: 20%; width: 60%; height: 30%; background: linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%); background-size: 200% 100%; animation: glass-shine 4s infinite linear; pointer-events: none;"></div>

                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(to bottom, transparent 70%, rgba(0,0,0,0.8));"></div>
                <div style="position: absolute; bottom: 8px; left: 0; width: 100%; text-align: center;">
                    <span id="amb-status" style="color: #FF3333; font-family: 'Courier New'; font-size: 22px; font-weight: 900; letter-spacing: 4px; text-shadow: 0 0 10px #FF0000; animation: glitch-text 0.2s infinite;">EMERGENCY UNIT</span>
                    <style>
                        @keyframes glitch-text {
                            0% { transform: translate(0); text-shadow: 2px 2px 0px #00FFFF, -2px -2px 0px #FF0055; }
                            25% { transform: translate(-2px, 2px); text-shadow: -2px 2px 0px #00FFFF, 2px -2px 0px #FF0055; }
                            50% { transform: translate(2px, -2px); text-shadow: 2px -2px 0px #00FFFF, -2px 2px 0px #FF0055; }
                            75% { transform: translate(-2px, -2px); text-shadow: -2px -2px 0px #00FFFF, 2px 2px 0px #FF0055; }
                            100% { transform: translate(0); text-shadow: 2px 2px 0px #00FFFF, -2px -2px 0px #FF0055; }
                        }
                        @keyframes strobe-blue {
                            0%, 30% { opacity: 1; transform: scale(1.1); }
                            33%, 100% { opacity: 0.1; transform: scale(0.9); }
                        }
                        @keyframes strobe-yellow {
                            0%, 30% { opacity: 0.1; transform: scale(0.9); }
                            33%, 63% { opacity: 1; transform: scale(1.1); }
                            66%, 100% { opacity: 0.1; transform: scale(0.9); }
                        }
                        @keyframes strobe-red {
                            0%, 63% { opacity: 0.1; transform: scale(0.9); }
                            66%, 96% { opacity: 1; transform: scale(1.1); }
                            100% { opacity: 0.1; transform: scale(0.9); }
                        }
                        @keyframes headlight-wigwag-left {
                            0%, 49% { opacity: 0; }
                            50%, 60% { opacity: 1; transform: scale(1.1); }
                            100% { opacity: 0; }
                        }
                        @keyframes headlight-wigwag-right {
                            0%, 10% { opacity: 1; transform: scale(1.1); }
                            40%, 100% { opacity: 0; }
                        }
                        @keyframes grill-flash {
                            0%, 50% { opacity: 0; }
                            51%, 100% { opacity: 1; transform: scale(1.2); }
                        }
                        @keyframes underglow-pulse {
                            0%, 100% { opacity: 0.4; transform: scaleX(0.9); }
                            50% { opacity: 0.8; transform: scaleX(1.05); }
                        }
                        @keyframes glass-shine {
                            0% { background-position: 200% 0; }
                            100% { background-position: -200% 0; }
                        }
                        @keyframes vehicle-scan-loop {
                            0% { top: -5%; opacity: 0; }
                            10% { opacity: 1; }
                            90% { opacity: 1; }
                            100% { top: 105%; opacity: 0; }
                        }
                    </style>
                </div>
                <!-- Scanline effect -->
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.1) 3px); pointer-events: none;"></div>
                <!-- Active Scanner Line -->
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: rgba(0, 255, 255, 0.8); box-shadow: 0 0 15px #00FFFF; animation: vehicle-scan-loop 3s ease-in-out infinite;"></div>
            </div>
        `;

        // Insert di dalam panel Device Select (di bawah judul, di atas select camera)
        const title = targetPanel.querySelector('.widget-title');
        if (title && title.nextSibling) {
            targetPanel.insertBefore(wrapper, title.nextSibling);
        } else {
            targetPanel.appendChild(wrapper);
        }
    }
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
    injectAmbulanceDisplay(); // Inject Ambulance Image di atas Target Data

    // CSS ADJUSTMENT: Geser area scan (Video Container) sedikit ke atas
    if (videoContainer) {
        videoContainer.style.marginTop = "-90px"; 
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

// --- INJECT CSS ANIMASI BORDER (SCANNING EFFECT) ---
function injectScanningStyles() {
    const css = `
    @keyframes stampDescend {
        0% { transform: translateY(-600px) scale(2) rotateX(45deg); opacity: 0; }
        60% { transform: translateY(20px) scale(0.9) rotateX(0deg); opacity: 1; }
        80% { transform: translateY(-10px) scale(1.05); }
        100% { transform: translateY(0) scale(0.85) rotate(-5deg); opacity: 1; }
    }
    @keyframes stampShadow {
        0% { transform: translate(-50%, 180px) scale(0); opacity: 0; }
        60% { transform: translate(-50%, 180px) scale(1.2); opacity: 0.8; }
        80% { transform: translate(-50%, 180px) scale(0.9); opacity: 0.6; }
        100% { transform: translate(-50%, 180px) scale(1); opacity: 0.4; }
    }
    @keyframes digitalSplash {
        0% { transform: translate(-50%, 180px) scale(0.1); opacity: 0; border-width: 10px; }
        20% { opacity: 1; }
        100% { transform: translate(-50%, 180px) scale(3); opacity: 0; border-width: 0px; }
    }
    @keyframes border-march {
        0% { background-position: 0 0, 100% 100%, 0 100%, 100% 0; }
        100% { background-position: 40px 0, -40px 100%, 0 -40px, 100% 40px; }
    }
    @keyframes strobe-pulse {
        0% {
            box-shadow: 0 0 15px #ff0000, inset 0 0 10px #ff0000;
            border-color: #ff0000;
        }
        15% {
            box-shadow: 0 0 30px #ff00ff, inset 0 0 20px #ff00ff;
            border-color: #ff00ff;
        }
        30% {
            box-shadow: 0 0 15px #0000ff, inset 0 0 10px #0000ff;
            border-color: #0000ff;
        }
        45% {
            box-shadow: 0 0 30px #00ffff, inset 0 0 20px #00ffff;
            border-color: #00ffff;
        }
        60% {
            box-shadow: 0 0 15px #00ff00, inset 0 0 10px #00ff00;
            border-color: #00ff00;
        }
        75% {
            box-shadow: 0 0 30px #ffff00, inset 0 0 20px #ffff00;
            border-color: #ffff00;
        }
        100% {
            box-shadow: 0 0 15px #ff0000, inset 0 0 10px #ff0000;
            border-color: #ff0000;
        }
    }
    @keyframes blinkText {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    .scanning-border {
        background-image: 
            linear-gradient(90deg, rgba(255,255,255,0.8) 50%, transparent 50%), 
            linear-gradient(90deg, rgba(255,255,255,0.8) 50%, transparent 50%), 
            linear-gradient(0deg, rgba(255,255,255,0.8) 50%, transparent 50%), 
            linear-gradient(0deg, rgba(255,255,255,0.8) 50%, transparent 50%);
        background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
        background-size: 30px 3px, 30px 3px, 3px 30px, 3px 30px;
        animation: border-march 1s infinite linear, strobe-pulse 0.8s infinite linear;
        border: 3px solid transparent !important;
        transition: all 0.3s ease;
    }
    .scanning-border-error {
        background-image: 
            linear-gradient(90deg, #FF0055 50%, transparent 50%), 
            linear-gradient(90deg, #FF0055 50%, transparent 50%), 
            linear-gradient(0deg, #FF0055 50%, transparent 50%), 
            linear-gradient(0deg, #FF0055 50%, transparent 50%);
        box-shadow: 0 0 25px rgba(255, 0, 85, 0.6), inset 0 0 15px rgba(255, 0, 85, 0.3) !important;
        border: 1px solid rgba(255, 0, 85, 0.1) !important;
    }
    `;
    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
}
injectScanningStyles();
