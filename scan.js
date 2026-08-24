//
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
const dlRoster = document.getElementById('dlRoster'); // [NEW]
const dlPanel = document.getElementById('dl-panel');   // [NEW]
const cutiRoster = document.getElementById('cutiRoster'); // [NEW]
const cutiPanel = document.getElementById('cuti-panel');   // [NEW]
const izinRoster = document.getElementById('izinRoster'); // [NEW]
const izinPanel = document.getElementById('izin-panel');   // [NEW]
let lastQuoteIndex = -1; // [NEW] Variabel global untuk mencegah pengulangan motivasi

// CORNER CARD ELEMENTS
const cornerProfileCard = document.getElementById('corner-profile-card');
const cornerPhoto = document.getElementById('corner-photo');
const cornerName = document.getElementById('corner-name');
const cornerJabatan = document.getElementById('corner-jabatan');
const cornerId = document.getElementById('corner-id');
const cornerStatus = document.getElementById('corner-status');

const stealthToggle = document.getElementById('stealthToggle');
const stealthIcon = document.getElementById('stealthIcon');

let labeledDescriptors = null;
let isDetectionActive = false; // Ganti interval ID dengan flag boolean
let isProcessing = false; // Kunci: true saat sedang kirim data/cooldown
let lastKnownMatch = null; 
let isTargetLocked = false; // Status penguncian target untuk efek suara
let employeeMap = {}; 
let currentStream = null; // Variabel untuk stream kamera aktif
const offscreenCanvas = document.createElement('canvas'); // [NEW] Canvas tersembunyi untuk pre-processing
const offCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
// [OPTIMIZED] Naikkan interval untuk hemat CPU. 150ms = ~7fps deteksi, cukup untuk Absensi.
const DETECTION_INTERVAL_MS     = 150; // Interval normal (ms)
const DETECTION_INTERVAL_FAST   = 50;  // [NEW] Interval turbo saat wajah terdeteksi
const DETECTION_INTERVAL_IDLE   = 300; // [NEW] Interval hemat CPU saat kamera kosong
const SUCCESS_COOLDOWN_MS = 10000; // Jeda 10 detik setelah berhasil scan
const DEFAULT_PHOTO = ''; // Path ke foto default/placeholder

let currentDetectionInterval = DETECTION_INTERVAL_MS; // [NEW] Adaptive interval aktif
let consecutiveEmptyFrames   = 0;                     // [NEW] Counter frame kosong berturut
let consecutiveFaceFrames    = 0;                     // [NEW] Counter frame ada wajah
const EMPTY_TO_IDLE_THRESHOLD = 10; // [NEW] Setelah 10 frame kosong → masuk mode idle
const FACE_TO_TURBO_THRESHOLD = 2;  // [NEW] Setelah 2 frame ada wajah → masuk mode turbo


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

let blazeModel = null; // [NEW] Variabel Model BlazeFace untuk Pre-Detection Cepat

// --- STABILIZER VARS (ANTI-ACAK) ---
let recognitionHistory = []; // Menyimpan hasil deteksi beberapa frame terakhir
const HISTORY_LIMIT = 4;     // [UPDATE] Turunkan ke 5 agar nama lebih CEPAT muncul (Responsif)
const MIN_CONSENSUS = 3;     // [UPDATE] Minimal 3 frame konsisten agar hasil AKURAT (Stabil)
let lockGraceCounter = 0;    // [NEW] Counter untuk menahan hasil lama (Anti-Flicker)
let lastStableResult = null; // [NEW] Menyimpan hasil valid terakhir
let isLastFaceCentered = false; // [NEW] Status posisi wajah frame sebelumnya (untuk warna target)
let lastNosePosition = null; // [NEW] Untuk deteksi kestabilan gerakan
let lastFaceBox = null;      // [NEW] Untuk ROI Tracking
let trackingMissCount = 0;   // [NEW] Counter jika tracking hilang
let stabilityCounter = 0;    // [NEW] Counter frame stabil
let userScanCounters = {};   // [NEW] Counter scan per user session

// --- LIVENESS DETECTION ENGINE (ANTI-SPOOFING: DETEKSI GERAKAN KEPALA) ---
// Sistem ini hanya memastikan user menggerakkan kepala sedikit saja (ke arah manapun).
// Jika kepala tidak bergerak sama sekali (foto/video statis), absen ditolak.
class LivenessDetector {
    constructor() {
        this.isLive = false;
        this.lastYaw = 0;
        this.lastPitch = 0;
        
        // Baseline (posisi awal kepala saat pertama terdeteksi)
        this.baselineYaw = 0;
        this.baselinePitch = 0;
        this.baselineSet = false;
        this.baselineFrames = 0;
        this.BASELINE_FRAMES_NEEDED = 3; // Frame untuk menentukan posisi awal
        
        // Tracking pergerakan
        this.yawSamples = [];       // Riwayat yaw beberapa frame terakhir
        this.pitchSamples = [];     // Riwayat pitch beberapa frame terakhir
        this.MAX_SAMPLES = 20;      // Buffer riwayat
        
        // Threshold gerakan (sangat kecil — cukup gerak sedikit)
        this.MOVEMENT_THRESHOLD = 0.08; // Threshold untuk deteksi bebas (kiri/kanan/atas/bawah)/ Delta yaw/pitch minimal — gerak sedikit namun pasti
        this.movementScore = 0;     // Akumulasi skor gerakan
        this.SCORE_TO_PASS = 2;     // Cukup 2 frame gerakan terdeteksi
        
        // TTS
        this.instructionSpoken = false;
        this.warningSpoken = false;
        this.startTime = 0;
        this.TIMEOUT_MS = 10000;    // 10 detik timeout
    }

    reset() {
        this.isLive = false;
        this.baselineSet = false;
        this.baselineFrames = 0;
        this.baselineYaw = 0;
        this.baselinePitch = 0;
        this.yawSamples = [];
        this.pitchSamples = [];
        this.movementScore = 0;
        this.lastYaw = 0;
        this.lastPitch = 0;
        this.instructionSpoken = false;
        this.warningSpoken = false;
        this.startTime = 0;
    }

    // Hitung Yaw (rotasi horizontal) dari landmarks
    computeYaw(landmarks) {
        const nose = landmarks.getNose()[3];
        const leftEye = landmarks.getLeftEye()[0];
        const rightEye = landmarks.getRightEye()[3];
        const faceWidth = Math.abs(rightEye.x - leftEye.x);
        if (faceWidth <= 0) return 0;
        return ((nose.x - leftEye.x) / faceWidth - 0.5) * 2;
    }

    // Hitung Pitch (rotasi vertikal) dari landmarks  
    computePitch(landmarks) {
        const nose = landmarks.getNose()[3];
        const leftEye = landmarks.getLeftEye()[0];
        const rightEye = landmarks.getRightEye()[3];
        const eyeCenterY = (leftEye.y + rightEye.y) / 2;
        const jaw = landmarks.getJawOutline()[8];
        const faceHeight = Math.abs(jaw.y - eyeCenterY);
        if (faceHeight <= 0) return 0;
        const noseRelY = (nose.y - eyeCenterY) / faceHeight;
        return (noseRelY - 0.5) * 2;
    }

    // Update per frame
    update(landmarks) {
        if (!landmarks) return false;
        if (this.isLive) return true;
        
        const yaw = this.computeYaw(landmarks);
        const pitch = this.computePitch(landmarks);
        this.lastYaw = yaw;
        this.lastPitch = pitch;

        // Fase 1: Kumpulkan baseline posisi awal
        if (!this.baselineSet) {
            this.baselineFrames++;
            if (this.baselineFrames >= this.BASELINE_FRAMES_NEEDED) {
                this.baselineYaw = yaw;
                this.baselinePitch = pitch;
                this.baselineSet = true;
                this.startTime = Date.now();
            }
            return false;
        }

        // Ucapkan instruksi sekali
        if (!this.instructionSpoken) {
            this.instructionSpoken = true;
            if (typeof SoundFX !== 'undefined' && SoundFX.speak) {
                // SoundFX.speak('Gerakkan kepala Anda sedikit untuk verifikasi'); // [DISABLED]
            }
        }

        // Simpan sample
        this.yawSamples.push(yaw);
        this.pitchSamples.push(pitch);
        if (this.yawSamples.length > this.MAX_SAMPLES) this.yawSamples.shift();
        if (this.pitchSamples.length > this.MAX_SAMPLES) this.pitchSamples.shift();

        // Cek delta dari baseline
        const deltaYaw = Math.abs(yaw - this.baselineYaw);
        const deltaPitch = Math.abs(pitch - this.baselinePitch);

        if (deltaYaw > this.MOVEMENT_THRESHOLD || deltaPitch > this.MOVEMENT_THRESHOLD) {
            this.movementScore++;
        }

        // Lulus jika cukup frame mendeteksi gerakan
        if (this.movementScore >= this.SCORE_TO_PASS) {
            this.isLive = true;
            console.log('[LIVENESS] PASSED — gerakan kepala terdeteksi');
            return true;
        }

        // Timeout warning
        if (!this.warningSpoken && Date.now() - this.startTime > 5000) {
            this.warningSpoken = true;
            if (typeof SoundFX !== 'undefined' && SoundFX.speak) {
                // SoundFX.speak('Kepala Anda belum bergerak. Silakan gerakkan sedikit.'); // [DISABLED]
            }
        }

        // Timeout → reset dan coba lagi
        if (Date.now() - this.startTime > this.TIMEOUT_MS) {
            console.log('[LIVENESS] Timeout — reset');
            this.baselineSet = false;
            this.baselineFrames = 0;
            this.movementScore = 0;
            this.yawSamples = [];
            this.pitchSamples = [];
            this.instructionSpoken = false;
            this.warningSpoken = false;
            return false;
        }

        return false;
    }

    // Gambar overlay instruksi di canvas
    drawLivenessOverlay(ctx, box) {
        if (this.isLive) return;
        if (!this.baselineSet) return;

        const cx = box.x + box.width / 2;
        const cy = box.y - 45;
        const instruction = 'Gerakkan kepala Anda sedikit';
        const remaining = Math.max(0, Math.ceil((this.TIMEOUT_MS - (Date.now() - this.startTime)) / 1000));
        const progress = Math.min(1, (Date.now() - this.startTime) / this.TIMEOUT_MS);

        ctx.save();

        // --- Pill background ---
        const pillW = 310;
        const pillH = 38;
        const pillX = cx - pillW / 2;
        const pillY = cy - pillH / 2;
        const pillR = pillH / 2;

        ctx.beginPath();
        ctx.moveTo(pillX + pillR, pillY);
        ctx.lineTo(pillX + pillW - pillR, pillY);
        ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillR, pillR);
        ctx.arcTo(pillX + pillW, pillY + pillH, pillX + pillW - pillR, pillY + pillH, pillR);
        ctx.lineTo(pillX + pillR, pillY + pillH);
        ctx.arcTo(pillX, pillY + pillH, pillX, pillY + pillR, pillR);
        ctx.arcTo(pillX, pillY, pillX + pillR, pillY, pillR);
        ctx.closePath();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // --- Ikon gerak + teks ---
        const pulse = 0.7 + 0.3 * Math.abs(Math.sin(Date.now() / 300));
        ctx.globalAlpha = pulse;
        ctx.font = 'bold 13px "Outfit", sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`↔  ${instruction}`, cx, cy);
        ctx.globalAlpha = 1;

        // --- Progress bar ---
        const barW = pillW - 16;
        const barH = 3;
        const barX = pillX + 8;
        const barY = pillY + pillH + 5;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(barX, barY, barW, barH);

        const r = Math.floor(255 * progress);
        const g = Math.floor(255 * (1 - progress));
        ctx.fillStyle = `rgb(${r}, ${g}, 50)`;
        ctx.fillRect(barX, barY, barW * (1 - progress), barH);

        // --- Timer ---
        ctx.font = '10px "Courier New", monospace';
        ctx.fillStyle = remaining <= 3 ? '#FF4444' : 'rgba(255, 215, 0, 0.7)';
        ctx.fillText(`${remaining}s`, cx, barY + barH + 12);

        // --- Movement score indicator (titik-titik) ---
        const dotY = barY + barH + 24;
        const dotSpacing = 14;
        const totalDots = this.SCORE_TO_PASS;
        const startX = cx - ((totalDots - 1) * dotSpacing) / 2;

        for (let i = 0; i < totalDots; i++) {
            const dx = startX + i * dotSpacing;
            ctx.beginPath();
            ctx.arc(dx, dotY, 4, 0, Math.PI * 2);
            if (i < this.movementScore) {
                ctx.fillStyle = '#00FF88';
                ctx.shadowColor = '#00FF88';
                ctx.shadowBlur = 6;
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.shadowBlur = 0;
            }
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        ctx.restore();
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
            // [UPGRADED] Cybernetic Radar Sweep
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(audioAnalyser);
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.15); // Sweep down fast
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(4000, now);
            filter.frequency.linearRampToValueAtTime(500, now + 0.15);
            
            gain.gain.setValueAtTime(0.0, now);
            gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            
            osc.start(now);
            osc.stop(now + 0.15);
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
            // [UPGRADED] Holographic Success Chime (Premium Glass Sound)
            
            // Layer 1: The Main Bell (Sine)
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.connect(gain1); gain1.connect(audioAnalyser);
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, now); // A5
            osc1.frequency.setValueAtTime(1108.73, now + 0.1); // C#6
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.1, now + 0.05);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
            osc1.start(now); osc1.stop(now + 1.2);

            // Layer 2: The Sparkle (High pitched triangle)
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2); gain2.connect(audioAnalyser);
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(1760, now); // A6
            gain2.gain.setValueAtTime(0, now);
            gain2.gain.linearRampToValueAtTime(0.03, now + 0.05);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc2.start(now); osc2.stop(now + 0.8);

            // Layer 3: The Bass Support (Warm low frequency)
            const osc3 = audioCtx.createOscillator();
            const gain3 = audioCtx.createGain();
            osc3.connect(gain3); gain3.connect(audioAnalyser);
            osc3.type = 'sine';
            osc3.frequency.setValueAtTime(220, now); // A3
            gain3.gain.setValueAtTime(0, now);
            gain3.gain.linearRampToValueAtTime(0.08, now + 0.1);
            gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
            osc3.start(now); osc3.stop(now + 1.5);
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
        } else if (type === 'robotic') {
            // [NEW] Suara Robotik (FM Synthesis - Frequency Modulation)
            // Menghasilkan suara "Gerrr" atau "Ziiing" khas mesin futuristik
            const t = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const mod = audioCtx.createOscillator(); // Modulator
            const modGain = audioCtx.createGain();
            const gain = audioCtx.createGain();

            // Konfigurasi Modulator (Getaran Cepat)
            mod.frequency.value = 50; // 50Hz = Suara kasar/robotik
            modGain.gain.value = 500; // Intensitas modulasi
            
            // Sambungkan Modulator ke Frekuensi Osilator Utama
            mod.connect(modGain);
            modGain.connect(osc.frequency);
            
            osc.connect(gain);
            gain.connect(audioAnalyser);

            osc.type = 'sawtooth'; // Gelombang gergaji (tajam)
            osc.frequency.setValueAtTime(200, t); // Nada dasar
            osc.frequency.linearRampToValueAtTime(50, t + 0.3); // Pitch turun (Power down effect)

            gain.gain.setValueAtTime(0.1, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

            mod.start(t); osc.start(t);
            mod.stop(t + 0.3); osc.stop(t + 0.3);
        }
    },
    // --- ELEVENLABS TTS ENGINE CONFIG ---
    elevenLabs: {
        // PERINGATAN: Pastikan API Key di bawah ini valid dari Dashboard ElevenLabs
        apiKey: "12d381ffd65727d06fc3f0dd0c704ad6b8d80b19ff742e577ab3b59994234c06",
        voiceId: "21m00Tcm4TlvDq8ikWAM", // Menggunakan ID Suara standar "George" (Pre-made) yang lebih stabil
        quotaExceeded: false // [FIX] Flag untuk skip ElevenLabs setelah error 402
    },
    cfWorkerUrl: null, // [NEW] Endpoint Cloudflare Worker TTS
    speak: async (text) => {
        if (isStealthMode) return; // Mute jika Stealth Mode aktif

        const runBrowserTTS = () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel(); 
                const utterance = new SpeechSynthesisUtterance(text);
                const voices = window.speechSynthesis.getVoices();
                
                // Pencarian suara Bahasa Indonesia yang lebih akurat
                const preferredVoice = voices.find(v => v.name.includes('Google Bahasa Indonesia')) 
                                    || voices.find(v => v.lang.startsWith('id')) 
                                    || voices.find(v => v.name.includes('Indonesian'))
                                    || voices[0];

                if (preferredVoice) utterance.voice = preferredVoice;
                utterance.lang = 'id-ID';
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        };

        // Jika Online, langsung gunakan bawaan browser (seperti Google Voice yg natural)
        if (navigator.onLine) {
            // Fix Chrome bug: getVoices() sering kosong saat dipanggil pertama kali
            if (window.speechSynthesis.getVoices().length === 0) {
                window.speechSynthesis.onvoiceschanged = runBrowserTTS;
            } else {
                runBrowserTTS();
            }
            return;
        }

        // --- FALLBACK OFFLINE ---
        try {
            // Gunakan Local Python TTS Server (Piper)
            const response = await fetch('http://localhost:5002/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: text })
            });

            if (!response.ok) {
                throw new Error(`Local TTS HTTP error! status: ${response.status}`);
            }

            SoundFX.play('comms_open'); // Play entry chime only on successful response

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioAnalyser); // Terhubung ke visualisator gelombang suara
            source.start(0);

        } catch (e) {
            logSystem(`VOICE MODULE: Local TTS failed (${e.message}). Menggunakan Browser TTS.`, 'text-sky-400');
            console.warn("TTS fallback engaged:", e.message);

            // Jika Piper mati saat offline, coba panggil Browser TTS lagi (pakai suara lokal spt Microsoft Gadis)
            if (window.speechSynthesis.getVoices().length === 0) {
                window.speechSynthesis.onvoiceschanged = runBrowserTTS;
            } else {
                runBrowserTTS();
            }
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
            
            // Liquid Gold Wave Effect
            const grad = ctx.createLinearGradient(0, (canvas.height - barHeight) / 2, 0, (canvas.height + barHeight) / 2);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            grad.addColorStop(0.3, 'rgba(20, 184, 166, 0.9)');
            grad.addColorStop(1, 'rgba(167, 139, 250, 0.2)');
            ctx.fillStyle = grad;
            ctx.shadowColor = 'rgba(20, 184, 166, 0.5)';
            ctx.shadowBlur = 8;
            ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth - 1, barHeight); // Center vertical
            ctx.shadowBlur = 0; // reset
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
    gradient.addColorStop(0, 'rgba(20, 184, 166, 0)');
    gradient.addColorStop(0.8, 'rgba(20, 184, 166, 0)');
    gradient.addColorStop(1, 'rgba(20, 184, 166, 0.1)');
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
            stealthToggle.className = 'bg-transparent border border-sky-500/50 text-sky-400 text-[10px] px-3 py-1 font-mono hover:bg-sky-900/30 transition-all duration-300';
            if(stealthIcon) stealthIcon.className = 'w-2 h-2 rounded-full bg-gray-600';
            logSystem('STEALTH MODE: DISENGAGED. Audio Online.', 'text-sky-400');
        }
    });
}

let FACE_MATCHING_THRESHOLD = 0.45; // [UPDATE] Diperketat ke 0.40 untuk Akurasi Tinggi (Anti-Acak)
// --- DEFINISI WARNA (Mewah & Berwibawa) ---
const PROFESSIONAL_STATUS_COLOR = '#DAA520'; // Royal Gold
const NAME_HIGHLIGHT_COLOR = '#1a1500'; // Deep Gold Black
const HEADER_COLOR = '#B8860B'; // Dark Goldenrod
const ABSEN_GANDA_BG = 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.2) 100%)'; 
const ABSEN_NORMAL_BG = 'linear-gradient(135deg, rgba(218,165,32,0.15) 0%, rgba(255,215,0,0.2) 100%)';
const AGENCY_NAME = 'PUSKESMAS WANA'; // Nama Instansi Global

// --- NEW FEATURE: DYNAMIC SYSTEM THEME ---
function setSystemTheme(status) {
    const root = document.documentElement;
    let primary, secondary, glow;
    
    switch(status) {
        case 'SUCCESS': 
            primary = '#FFD700'; secondary = '#DAA520'; glow = 'rgba(255,215,0,0.4)'; 
            break;
        case 'ERROR': 
            primary = '#ef4444'; secondary = '#b91c1c'; glow = 'rgba(239, 68, 68, 0.4)'; 
            break;
        case 'SCANNING': 
            primary = '#DAA520'; secondary = '#B8860B'; glow = 'rgba(218,165,32,0.4)'; 
            break;
        default: // IDLE
            primary = '#FFD700'; secondary = '#DAA520'; glow = 'rgba(255,215,0,0.2)';
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
        logSystem('SENSOR: STANDARD OPTICS RESTORED', 'text-sky-400');
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
            ctx.fillStyle = `rgba(20, 184, 166, ${intensity * 0.6})`;
            ctx.fill();
            ctx.lineWidth = 1.5;
        } else {
            // Sudah stabil (Cyan redup)
            ctx.strokeStyle = 'rgba(20, 184, 166, 0.15)';
            ctx.fillStyle = 'rgba(20, 184, 166, 0.02)'; 
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
        ctx.strokeStyle = `rgba(20, 184, 166, 0.5)`;
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
             ctx.fillStyle = '#DAA520';
             ctx.shadowBlur = 0;
        }
        ctx.fill();
    }
    
    // 4. LASER SCAN LINE (Garis Horizontal Pemicu)
    ctx.beginPath();
    ctx.moveTo(points[0].x - 25, scanY);
    ctx.lineTo(points[16].x + 25, scanY);
    ctx.strokeStyle = 'rgba(218, 165, 32, 0.9)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#FFD700';
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

// --- [NEW] LIVE TELEMETRY & PROGRESS RING ---
function drawBiometricProgress(ctx, box, progress, color) {
    const { x, y, width, height } = box;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const radius = Math.max(width, height) * 0.55;

    ctx.save();
    // 1. Background Circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Progress Arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * progress));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.stroke();

    // 3. Telemetry Text
    ctx.fillStyle = color;
    ctx.font = '9px "Share Tech Mono", monospace';
    const hex = Math.random().toString(16).substr(2, 8).toUpperCase();
    ctx.fillText(`ENC_KEY: ${hex}`, x, y + height + 25);
    ctx.fillText(`COORD_X: ${cx.toFixed(2)}`, x, y + height + 35);
    ctx.fillText(`COORD_Y: ${cy.toFixed(2)}`, x, y + height + 45);
    
    ctx.restore();
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

    // [UPDATE] Logika Warna Dinamis (Amber = Standby, Emerald = Pas)
    const baseColor = isCentered ? '210, 164, 93' : '197, 139, 69'; // RGB: Light Gold vs Deep Gold
    const strokeStyle = `rgba(${baseColor}, ${isCentered ? 0.8 : 0.25})`; // Lebih terang jika pas

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
    ctx.strokeStyle = 'rgba(20, 184, 166, 0.3)';
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
    ctx.fillStyle = isCentered ? `rgba(210, 164, 93, ${blinkAlpha})` : `rgba(255, 255, 0, ${blinkAlpha})`;
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
        ctx.fillStyle = isCentered ? `rgba(210, 164, 93, ${blinkAlpha})` : `rgba(255, 255, 0, ${blinkAlpha})`;
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
    ctx.lineWidth = 1.5;
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
    ctx.strokeStyle = 'rgba(20, 184, 166, 0.6)';
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
            ctx.fillStyle = `rgba(20, 184, 166, ${intensity * 0.6})`;
            ctx.fill();
            ctx.lineWidth = 1.5;
        } else {
            // Sudah stabil (Cyan redup)
            ctx.strokeStyle = 'rgba(20, 184, 166, 0.15)';
            ctx.fillStyle = 'rgba(20, 184, 166, 0.02)'; 
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

// --- VISUAL FX: FIREWORKS (KEMBANG API) ---
function triggerFireworks() {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99999'; // Di atas segalanya
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    
    const particles = [];
    
    function createExplosion(x, y) {
        const hue = Math.random() * 360;
        // [UPDATE] Lebih banyak partikel untuk kepadatan
        const particleCount = 80 + Math.random() * 50; 
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            // [UPDATE] Kecepatan ledakan lebih variatif (Realistis)
            const velocity = Math.random() * 15 + 2; 
            const friction = 0.95 + Math.random() * 0.03; // Hambatan udara

            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity,
                alpha: 1,
                // [UPDATE] Warna HSL cerah dengan variasi hue sedikit
                color: `hsl(${hue + Math.random() * 40 - 20}, 100%, ${60 + Math.random() * 20}%)`,
                decay: Math.random() * 0.02 + 0.015, // [MODIFIED] Sangat cepat (Total durasi ~3 detik)
                gravity: 0.15, // Gravitasi sedikit lebih kuat
                friction: friction,
                size: Math.random() * 3 + 1,
                shimmer: Math.random() < 0.2 // 20% partikel berkedip
            });
        }
    }

    let frame = 0;
    function loop() {
        frame++;
        
        // [UPDATE] Efek Trail (Ekor) pada canvas transparan
        // Menggunakan destination-out untuk menghapus perlahan (membuat jejak)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // Semakin kecil alpha, semakin panjang ekornya
        ctx.fillRect(0, 0, w, h);
        
        // Kembali ke mode gambar normal (tapi lighter untuk efek glowing)
        ctx.globalCompositeOperation = 'lighter';

        // Spawn fireworks randomly for ~1.5 seconds (approx 90 frames)
        if (frame < 90 && Math.random() < 0.05) {
            createExplosion(Math.random() * w, Math.random() * h * 0.6);
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            
            // Physics Update
            p.vx *= p.friction;
            p.vy *= p.friction;
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
            
            if (p.alpha <= 0) {
                particles.splice(i, 1);
            } else {
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                
                // [UPDATE] Efek Shimmer (Berkedip Putih)
                if (p.shimmer && Math.random() < 0.3) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        if (particles.length > 0 || frame < 90) {
            requestAnimationFrame(loop);
        } else {
            canvas.remove();
        }
    }
    loop();
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

// [NEW] HELPER: TOAST NOTIFICATION
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    
    let bgColor = 'bg-emerald-900/90';
    let borderColor = 'border-emerald-400';
    let textColor = 'text-white';
    let icon = '<i class="fa-solid fa-circle-info"></i>';
 
    if (type === 'success') {
        borderColor = 'border-green-400';
        textColor = 'text-green-300';
        icon = '<i class="fa-solid fa-circle-check"></i>';
    } else if (type === 'error') {
        borderColor = 'border-red-400';
        textColor = 'text-red-300';
        icon = '<i class="fa-solid fa-circle-xmark"></i>';
    } else if (type === 'warning') {
        borderColor = 'border-amber-400';
        textColor = 'text-amber-300';
        icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
    }
 
    toast.className = `flex items-center gap-4 p-4 rounded-lg shadow-2xl border ${bgColor} border-l-4 ${borderColor} transform transition-all duration-300 translate-x-full opacity-0 min-w-[350px] backdrop-blur-md`;
    toast.innerHTML = `
        <div class="text-xl ${textColor}">${icon}</div>
        <div class="flex-1">
            <p class="font-bold text-white">${message}</p>
            <p class="text-xs text-white/50 font-mono">${new Date().toLocaleTimeString('id-ID')}</p>
        </div>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
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
    
    // Voice Greeting (dipercepat)
    setTimeout(() => SoundFX.speak("Sistem Online. Sensor Optik Dikalibrasi."), 100);

    for (const line of lines) {
        const p = document.createElement('div');
        p.className = 'boot-line';
        p.innerHTML = `> ${line}`;
        bootLog.appendChild(p);
        await new Promise(r => setTimeout(r, Math.random() * 20 + 10)); // Dipercepat dari 100-300ms ke 10-30ms
    }

    await new Promise(r => setTimeout(r, 100)); // Dipercepat dari 600ms
    bootScreen.style.transition = "opacity 0.2s ease-out";
    bootScreen.style.opacity = "0";
    setTimeout(() => bootScreen.remove(), 250); // Dipercepat dari 800ms
}

// --- NEW FEATURE: SMART HUD LABEL ---
function drawSmartHUD(ctx, box, label, color, confidence, emotion = '-', gender = '-', age = '-') {
    const tagX = box.x + box.width + 30;
    const tagY = box.y;
    const hudWidth = 180;
    const hudHeight = 70;

    // 1. Garis Penghubung (Connector Line)
    ctx.beginPath();
    ctx.moveTo(box.x + box.width, box.y + (box.height * 0.2));
    ctx.lineTo(tagX - 10, box.y + (box.height * 0.2));
    ctx.lineTo(tagX, tagY);
    ctx.lineTo(tagX + hudWidth, tagY);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Background Panel HUD
    ctx.fillStyle = 'rgba(5, 15, 20, 0.85)';
    ctx.fillRect(tagX, tagY, hudWidth, hudHeight);
    
    // 3. Border Kiri HUD (Aksen Warna Status)
    ctx.fillStyle = color;
    ctx.fillRect(tagX, tagY, 4, hudHeight);

    // 4. Teks Informasi (Nama/Label)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Rajdhani", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label.length > 15 ? label.substring(0, 15) + '...' : label, tagX + 15, tagY + 25);

    // 5. Sub-info — ID statis per session (tidak Math.random() setiap frame)
    ctx.fillStyle = '#DAA520';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText(`MATCH-CONF: ${Math.min(100, Math.max(0, confidence)).toFixed(0)}%`, tagX + 15, tagY + 45);

    // 6. Confidence Bar Mini
    const confVal = Math.min(100, Math.max(0, confidence));
    ctx.fillStyle = '#333';
    ctx.fillRect(tagX + 15, tagY + 55, 100, 4);
    ctx.fillStyle = confVal > 70 ? '#F59E0B' : (confVal > 40 ? '#FFD700' : '#FF0055');
    ctx.fillRect(tagX + 15, tagY + 55, confVal, 4);

    // [DISABLED] Emotion & Bio readout dinonaktifkan (AgeGenderNet & FaceExpressionNet off)
}

// =============================================================================
// 2. FUNGSI UTILITAS & HUD (Diadaptasi untuk HTML baru)
// =============================================================================

function logSystem(message, color = 'text-green-500') {
    return; // Kontainer log telah dihapus, fungsi dinonaktifkan.
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

    // Selalu gunakan font serif dan efek teks emas metalik untuk kesan premium
    statusMessage.className = 'text-2xl lg:text-3xl font-serif font-bold transition-all duration-500 uppercase tracking-widest text-cyan-300';
    
    // Tentukan warna shadow berdasarkan colorClass untuk efek glow
    let shadowColor = '#06b6d4'; // Default untuk text-cyan-300
    
    // Terapkan font-family dan text-shadow untuk kedalaman dan glow
            statusMessage.style.filter = `drop-shadow(0 0 8px ${shadowColor}60)`; // Tambahan drop-shadow untuk efek lebih tebal

    if (isPulsing) {
        statusMessage.classList.add('animate-pulse');
    } else {
        statusMessage.className = "text-xl lg:text-2xl font-bold transition-colors duration-300";
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
        logSystem(`Canvas resized to ${W}x${videoH}.`, 'text-sky-400');
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
    entry.className = 'flex justify-between items-center border-b border-white/10 pb-1.5 mb-1.5 animate-[fadeIn_0.5s_ease-out]';
    entry.innerHTML = `
        <span class="text-white font-bold truncate w-2/3 flex items-center gap-2">
            <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_5px_rgba(218,165,32,0.6)]"></span>
            ${name}
        </span>
        <span class="text-white/60 text-[10px] font-mono font-bold">${time}</span>
    `;
    
    attendanceLog.prepend(entry);
    attendanceLog.scrollTop = 0; // [NEW] Auto-scroll ke atas
    
    // Batasi log agar tidak terlalu panjang
    if (attendanceLog.children.length > 50) {
        attendanceLog.removeChild(attendanceLog.lastChild);
    }
}

// Panggil update HUD pada interval
function updateClock() {
    const now = new Date();
    const time = Date.now();

    const clockH = document.getElementById('clock-h');
    const clockM = document.getElementById('clock-m');
    const clockS = document.getElementById('clock-s');
    const clockMsSoph = document.getElementById('clock-ms-soph');
    const clockRingSec = document.getElementById('clock-ring-sec');
    const clockDateSoph = document.getElementById('clock-date-soph');
    const teleUnix = document.getElementById('tele-unix');
    const teleJulian = document.getElementById('tele-julian');

    if (clockH) clockH.textContent = String(now.getHours()).padStart(2, '0');
    if (clockM) clockM.textContent = String(now.getMinutes()).padStart(2, '0');
    if (clockS) clockS.textContent = String(now.getSeconds()).padStart(2, '0');

    if (clockMsSoph) {
        const ms = String(now.getMilliseconds()).padStart(3, '0');
        const micro = String(Math.floor(Math.random() * 99)).padStart(2, '0');
        clockMsSoph.textContent = `.${ms.substring(0, 2)}${micro}`;
    }

    if (clockRingSec) {
        const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
        const dash = (seconds / 60) * 282.7; // 2 * PI * 45
        clockRingSec.setAttribute('stroke-dasharray', `${dash} 282.7`);
    }

    if (clockDateSoph) {
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        clockDateSoph.textContent = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} [${days[now.getDay()]}]`;
    }

    if (teleUnix) teleUnix.textContent = `0x${Math.floor(time / 1000).toString(16).toUpperCase()}`;

    if (teleJulian) {
        const start = new Date(now.getFullYear(), 0, 0);
        const dayOfYear = Math.floor((now - start) / 86400000);
        teleJulian.textContent = `JD.${String(dayOfYear).padStart(3, '0')}`;
    }
    
    requestAnimationFrame(updateClock);
}

function animateTitle() {
    return; // Disabled dynamically overwriting header to preserve HTML layout
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
        sigerContainer.style.marginTop = '-12px'; // Digeser ke atas agar sejajar panel samping
        sigerContainer.innerHTML = `
        <div style="
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            width: 100%; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 16px; 
            border: 1px solid rgba(251, 191, 36, 0.5); 
            background: linear-gradient(135deg, rgba(3, 7, 18, 0.9) 0%, rgba(3, 7, 18, 0.95) 100%);
            backdrop-filter: blur(20px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(251, 191, 36, 0.05);
            position: relative;
            border-radius: 12px;
        ">
            <div style="display: flex; flex-direction: row; align-items: stretch; justify-content: center; width: 100%; gap: 15px;">
                
                <!-- CHRONO MODULE (ACADEMIC) -->
                <div style="flex: 1.6; border: 1px solid rgba(251, 191, 36, 0.3); padding: 15px; background: rgba(0,0,0,0.3); position: relative; display: flex; align-items: center; gap: 20px; border-radius: 8px;">
                    <div style="width: 90px; height: 90px; position: relative;">
                        <svg viewBox="0 0 100 100" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,215,0,0.1)" stroke-width="2" />
                            <circle id="clock-ring-sec" cx="50" cy="50" r="45" fill="none" stroke="#FBBF24" stroke-width="4" stroke-dasharray="0 283" style="transition: stroke-dasharray 0.1s linear;" stroke-linecap="round" />
                        </svg>
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; pointer-events: none;">
                            <span id="clock-s" style="font-size: 30px; font-weight: 700; color: #FBBF24; font-family: 'Inter', sans-serif;">--</span>
                            <span id="clock-ms-soph" style="font-size: 11px; color: #FBBF24; margin-top: -5px; font-family: 'Inter', sans-serif; opacity: 0.7;">.00</span>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column;">
                        <div style="font-size: 11px; color: #FBBF24; letter-spacing: 2px; font-family: 'Inter', sans-serif; opacity: 0.8; margin-bottom: 4px;">WAKTU SISTEM</div>
                        <div style="display: flex; align-items: baseline; font-family: 'Lora', serif; font-weight: 700; color: #FFF; text-shadow: 0 0 15px rgba(255,215,0,0.4);">
                            <span id="clock-h" style="font-size: 58px; line-height: 1;">--</span>
                            <span style="font-size: 42px; margin: 0 4px; animation: blink 1s infinite; opacity: 0.8;">:</span>
                            <span id="clock-m" style="font-size: 58px; line-height: 1;">--</span>
                        </div>
                    </div>
                </div>

                <!-- TELEMETRY & IMAGE (ACADEMIC) -->
                <div style="flex: 2.2; height: 125px; position: relative; border: 1px solid rgba(255,215,0,0.5); overflow: hidden; background: #022c22; border-radius: 8px; box-shadow: inset 0 0 20px rgba(0,0,0,0.8);">
                    <img src="pkm.jpg" alt="PKM" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.85; filter: contrast(1.1) sepia(0.2) hue-rotate(-10deg);">
                </div>
            </div>
        </div>
        <style>
            @keyframes floatLogo {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-5px); }
            }
            @keyframes holo-flicker {
                0%, 100% { opacity: 0.8; }
                50% { opacity: 0.4; transform: scale(1.02); }
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
            mainLogo.style.top = '65px'; // Digeser ke bawah agar tidak tertutup ticker Motto
            mainLogo.style.left = '30px';
            mainLogo.style.width = '48px'; 
            mainLogo.style.height = '48px';
            mainLogo.style.borderRadius = '50%'; 
            mainLogo.style.objectFit = 'cover';
            mainLogo.style.zIndex = '101';
            mainLogo.style.filter = 'drop-shadow(0 0 8px rgba(255,215,0,0.6))';
        }

        // --- POSISI JUDUL: POJOK KIRI ATAS (HUD STYLE) ---
        mainTitle.style.position = 'fixed';
        mainTitle.style.top = '68px'; // Digeser ke bawah mengikuti logo
        mainTitle.style.left = '88px'; // Penyesuaian jarak (30px + 48px logo + 10px gap)
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
            span.style.color = '#DAA520'; 
            span.style.textShadow = '0 0 10px rgba(251, 191, 36, 0.5)';
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
            let color = '#DAA520'; 
            let textShadow = '0 0 8px rgba(251, 191, 36, 0.6)';
            let transform = 'scale(1) translateZ(0px)';
            let opacity = 0.8 + (Math.sin(time * 3 + i) * 0.1); // Breathing effect

            // Hitung jarak dari gelombang
            const dist = Math.abs(i - wavePos);

            // Efek Highlight (Passing Beam)
            if (dist < 1.5) {} else if (dist < 3) {}

            // Efek Glitch Acak (Digital Noise)
            if (Math.random() < 0.01) {
                const glitchChars = "X@#$%=+<>?01";
                char = glitchChars[Math.floor(Math.random() * glitchChars.length)];
                color = '#FF0055'; // Error Red
                textShadow = '2px 0 0 #DAA520, -2px 0 0 #FF0055'; 
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
let cutiScrollInterval = null; // [NEW] Untuk panel Cuti

// [NEW] Fungsi Auto Scroll dinonaktifkan di JS karena digantikan oleh CSS Animation (GPU Accelerated)
// yang jauh lebih mulus dan anti-patah, seperti permintaan untuk meniru panel DAFTAR HADIR.
function startRosterAutoScroll() {
    // Kosong (ditangani CSS @keyframes rosterTickerVertical)
}

async function updatePersonnelRoster() {
    if (!personnelRoster) return;
    
    try {
        // Ambil data absensi hari ini dari server
        const data = await api.getTodayAttendance();
        
        personnelRoster.innerHTML = '';
        personnelRoster.style.overflow = 'auto';

        // [NEW] Reset DL Roster
        if (dlRoster) dlRoster.innerHTML = '';
        if (cutiRoster) cutiRoster.innerHTML = '';
        if (izinRoster) izinRoster.innerHTML = '';
        
        if (!data || data.length === 0) {
            personnelRoster.innerHTML = '<div style="color:rgba(0,229,160,0.5);" class="text-xs italic text-center py-4">Belum ada data kehadiran hari ini.</div>';
            if (dlRoster) dlRoster.innerHTML = '<div style="color:rgba(255,215,0,0.5);" class="text-sm italic text-center py-4">Tidak ada data dinas luar.</div>';
            if (cutiRoster) cutiRoster.innerHTML = '<div style="color:rgba(255,215,0,0.5);" class="text-sm italic text-center py-4">Tidak ada data cuti.</div>';
            if (izinRoster) izinRoster.innerHTML = '<div style="color:rgba(255,215,0,0.5);" class="text-sm italic text-center py-4">Tidak ada data izin.</div>';
            
            // Reset counter badges
            const hadirBadge = document.getElementById('hadir-counter-badge');
            if (hadirBadge) hadirBadge.textContent = '0';
            const cutiBadge = document.getElementById('cuti-counter-badge');
            if (cutiBadge) cutiBadge.textContent = '0';
            const dlBadge = document.getElementById('dl-counter-badge');
            if (dlBadge) dlBadge.textContent = '0';
            const izinBadge = document.getElementById('izin-counter-badge');
            if (izinBadge) izinBadge.textContent = '0';
            return;
        }

        // [UPDATE] Sorting Super Prioritas: Siapa yang barusan absen (Masuk/Pulang) naik ke paling atas
        data.sort((a, b) => {
            // Ambil waktu aktivitas terakhir
            const timeA = a.jam_keluar || a.jam_masuk || '00:00:00';
            const timeB = b.jam_keluar || b.jam_masuk || '00:00:00';
            
            // Jika salah satu punya jam_keluar dan yang lain tidak, yang punya jam_keluar (Pulang) di atas
            if (a.jam_keluar && !b.jam_keluar) return -1;
            if (!a.jam_keluar && b.jam_keluar) return 1;

            // Jika sama-sama sudah pulang atau sama-sama baru masuk, urutkan jam terbaru
            return timeB.localeCompare(timeA);
        });

        const regularWrapper = document.createElement('div');
        regularWrapper.className = 'w-full flex flex-col gap-1';
        
        const dlWrapper = document.createElement('div');
        dlWrapper.className = 'w-full flex flex-col gap-1';

        const cutiWrapper = document.createElement('div');
        cutiWrapper.className = 'w-full flex flex-col gap-1';

        const izinWrapper = document.createElement('div');
        izinWrapper.className = 'w-full flex flex-col gap-1';

        let hasDL = false;
        let hasCuti = false;
        let hasIzin = false;
        let cutiCount = 0;
        let dlCount = 0;
        let izinCount = 0;
        let hadirCount = 0;

        data.forEach(row => {
            // ... (logika rendering tetap sama)
            const empData = employeeMap[row.id_karyawan] || {};
            const photoSrc = empData.foto ? `data:image/jpeg;base64,${empData.foto}` : 'logo.jpg';
            
            const statusRaw = row.status ? row.status.toUpperCase().trim() : '';
            const isDL = ['DL', 'DINAS_LUAR', 'DINAS LUAR'].includes(statusRaw);
            const isCuti = ['CUTI'].includes(statusRaw);
            const isIzin = ['IZIN', 'I', 'SAKIT', 'S', 'IJIN', 'SICK'].includes(statusRaw);
            const isOut = !!row.jam_keluar;
            
            let timeDisplay = '', statusColor, statusText = '', borderColor, bgHover, statusLabelHtml, bgGradient, glowColor = '', badgeStyle, timeGradient;
            let cardBorderClass = '';

            if (isDL) {
                timeDisplay = 'DINAS LUAR';
                statusText = 'DINAS LUAR';
            } else if (isCuti) {
                timeDisplay = 'CUTI';
                statusText = 'CUTI';
            } else if (isIzin) {
                timeDisplay = 'IZIN';
                statusText = 'IZIN';
            } else if (isOut) {
                timeDisplay = row.jam_keluar ? row.jam_keluar.substring(0,5) : '-';
                statusText = 'PULANG';
            } else {
                timeDisplay = row.jam_masuk ? row.jam_masuk.substring(0,5) : '-';
                statusText = 'HADIR';
            }

            // === BEYOND GOD-TIER CARD STYLING ===
            const statusConfig = {
                cuti:  { glow: '#f59e0b', accent: '#fbbf24', text: 'CUTI', bg1: 'rgba(245, 158, 11, 0.15)', bg2: 'rgba(245, 158, 11, 0.05)' },
                izin:  { glow: '#0ea5e9', accent: '#38bdf8', text: 'IZIN', bg1: 'rgba(14, 165, 233, 0.15)', bg2: 'rgba(14, 165, 233, 0.05)' },
                dl:    { glow: '#8b5cf6', accent: '#c084fc', text: 'DINAS LUAR', bg1: 'rgba(139, 92, 246, 0.15)', bg2: 'rgba(139, 92, 246, 0.05)' },
                out:   { glow: '#f43f5e', accent: '#fb7185', text: 'PULANG', bg1: 'rgba(244, 63, 94, 0.3)', bg2: 'rgba(244, 63, 94, 0.1)' },
                hadir: { glow: '#10b981', accent: '#34d399', text: 'HADIR', bg1: 'rgba(16, 185, 129, 0.15)', bg2: 'rgba(16, 185, 129, 0.05)' }
            };

            const cfg = isCuti ? statusConfig.cuti : isIzin ? statusConfig.izin : isDL ? statusConfig.dl : isOut ? statusConfig.out : statusConfig.hadir;
            
            glowColor = cfg.glow;

            const item = document.createElement('div');
            item.className = `roster-card-3d group flex items-center p-2.5 rounded-xl border transition-all duration-500 animate-[fadeIn_0.6s_cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden select-none cursor-pointer mb-2 mx-1`;

            const cardBg = `linear-gradient(135deg, ${cfg.bg1} 0%, ${cfg.bg2} 100%)`;
            
            item.style.cssText = `
                background: ${cardBg};
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-top: 1px solid rgba(255, 255, 255, 0.3);
                border-left: 1px solid rgba(255, 255, 255, 0.25);
                box-shadow: 0 15px 35px rgba(0,0,0,0.4), 0 5px 15px rgba(0,0,0,0.2);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-radius: 18px;
                transform-style: preserve-3d;
            `;

            if (isCuti || isIzin) {
                item.style.borderStyle = 'dashed';
                item.style.borderWidth = '1px';
            }

            const radarPingHTML = isDL ? `<div class="absolute inset-0 rounded-xl" style="border: 2px solid ${glowColor}; animation: radarPing 3s infinite ease-out; pointer-events:none;"></div>` : '';
            const dlIcon = isDL ? `<i class="fa-solid fa-car-side text-purple-400 opacity-70 text-sm" title="Dinas Luar"></i>` : '';
            const cutiIcon = isCuti ? `<i class="fa-solid fa-umbrella-beach text-amber-400 opacity-70 text-sm" title="Cuti"></i>` : '';
            const izinIcon = isIzin ? `<i class="fa-solid fa-envelope-open-text text-sky-400 opacity-70 text-sm" title="Izin"></i>` : '';

            item.innerHTML = `
                ${radarPingHTML}

                <!-- Left Accent Glow -->
                <div class="absolute left-0 top-0 bottom-0 w-[4px] z-20 rounded-l-xl" style="background: ${glowColor}; box-shadow: 0 0 10px ${glowColor};"></div>

                <!-- Hover Shimmer -->
                <div class="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none z-20 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-opacity duration-300"></div>

                <!-- PHOTO AVATAR -->
                <div class="relative flex-shrink-0 z-10 ml-3">
                    <img src="${photoSrc}" class="w-16 h-16 rounded-full object-cover border-[3px] border-white shadow-[0_0_15px_rgba(0,0,0,0.8)] z-10 relative">
                    <div class="absolute inset-0 rounded-full blur-md opacity-60 -z-10" style="background: ${glowColor};"></div>
                    <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#1a1a1a] flex items-center justify-center shadow-lg z-20" style="background: ${glowColor};">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background: ${glowColor};"></span>
                    </div>
                </div>

                <!-- INFO SECTION -->
                <div class="flex-grow min-w-0 z-10 ml-4">
                    <div class="flex items-center justify-between">
                        <p class="font-extrabold text-white text-lg truncate drop-shadow-lg tracking-wide leading-tight">${row.nama}</p>
                        ${dlIcon || cutiIcon || izinIcon || ''}
                    </div>
                    
                    <p class="text-xs font-bold truncate uppercase tracking-widest mt-0.5 drop-shadow-md" style="color: ${glowColor};">${row.jabatan || '-'}</p>

                    <div class="flex items-center gap-1.5 mt-2.5">
                        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border shadow-inner" style="background: rgba(0,0,0,0.6); border-color: ${glowColor}50;">
                            <i class="${isOut ? 'fa-solid fa-arrow-right-from-bracket' : isDL || isCuti || isIzin ? 'fa-solid fa-calendar-check' : 'fa-solid fa-arrow-right-to-bracket'} text-[10px]" style="color: ${glowColor};"></i>
                            <span class="text-[11px] font-mono font-bold tracking-widest text-white">${timeDisplay}</span>
                        </div>
                        
                        <div class="flex items-center px-2 py-1 rounded-md shadow-lg border border-white/20 ml-auto" style="background: ${glowColor};">
                            <span class="text-[9px] font-black tracking-widest uppercase text-white drop-shadow-md" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">
                                ${statusText === 'SUDAH PULANG' ? 'PULANG' : statusText}
                            </span>
                        </div>
                    </div>
                </div>
            `;
            
            if (isDL && dlRoster) {
                dlWrapper.appendChild(item);
                hasDL = true;
                dlCount++;
            } else if (isCuti && cutiRoster) {
                cutiWrapper.appendChild(item);
                hasCuti = true;
                cutiCount++;
            } else if (isIzin && izinRoster) {
                izinWrapper.appendChild(item);
                hasIzin = true;
                izinCount++;
            } else {
                regularWrapper.appendChild(item);
                hadirCount++;
            }
        });
        
        personnelRoster.appendChild(regularWrapper);
        personnelRoster.scrollTop = 0;

        // Update counter badges
        const hadirBadge = document.getElementById('hadir-counter-badge');
        if (hadirBadge) hadirBadge.textContent = `${hadirCount} `;

        const cutiBadge = document.getElementById('cuti-counter-badge');
        if (cutiBadge) cutiBadge.textContent = `${cutiCount} `;

        const dlBadge = document.getElementById('dl-counter-badge');
        if (dlBadge) dlBadge.textContent = `${dlCount} `;

        const izinBadge = document.getElementById('izin-counter-badge');
        if (izinBadge) izinBadge.textContent = `${izinCount} `;

        // [NEW] Update Panels
        if (dlRoster && dlPanel) {
            if (hasDL) {
                dlRoster.appendChild(dlWrapper);
                dlPanel.classList.remove('hidden');
            } else {
                dlRoster.innerHTML = '<div class="text-gray-500 text-sm italic text-center py-4">Tidak ada data dinas luar.</div>';
            }
        }

        if (cutiRoster && cutiPanel) {
            if (hasCuti) {
                cutiRoster.appendChild(cutiWrapper);
                cutiRoster.scrollTop = 0;
                cutiPanel.classList.remove('hidden');
            } else {
                cutiRoster.innerHTML = '<div class="text-gray-500 text-sm italic text-center py-4">Tidak ada data cuti.</div>';
            }
        }

        if (izinRoster && izinPanel) {
            if (hasIzin) {
                izinRoster.appendChild(izinWrapper);
                izinRoster.scrollTop = 0;
                izinPanel.classList.remove('hidden');
            } else {
                izinRoster.innerHTML = '<div class="text-gray-500 text-sm italic text-center py-4">Tidak ada data izin.</div>';
                izinPanel.classList.add('hidden');
            }
        }

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
                console.warn("DIAGNOSTIK: Respons server bukan format JSON yang valid."); // Restored
                throw new Error(`Invalid JSON received. Cek Console (F12) untuk melihat respons server.`);
            }
        } catch (error) {
            console.error('Error loading descriptors:', error);
            // console.error('Error loading descriptors:', error); // Suppress duplicate logging
            throw error; // Lemparkan error agar bisa ditangkap oleh pemanggil
        }
    }, // Restored
    getConfig: async () => {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            return null;
        }
    },
    postAttendance: async (karyawanId, imageBase64) => {
        // =================================================================
        // ALUR HYBRID: Python InsightFace + Node.js Attendance
        // 1. Kirim gambar ke Python untuk verifikasi InsightFace
        // 2. Jika terverifikasi, catat absensi via Node.js
        // 3. Jika Python mati, langsung ke Node.js (fallback)
        // =================================================================
        let pythonVerified = false;
        let pythonScore = 0;
        let pythonEngine = 'none';

        // --- STEP 1: Verifikasi InsightFace (Python Server) DIBAYPASS SESUAI PERMINTAAN ---
        pythonVerified = true;
        pythonScore = 100;
        pythonEngine = 'nodejs_only';
        console.log('🐍 [PYTHON] Verifikasi dibypass, menggunakan Node.js (server.js) saja.');
        logSystem('AI ENGINE: Menggunakan Node.js', 'text-sky-400');

        // --- STEP 2: Catat Absensi via Node.js ---
        try {
            const response = await fetch('/api/absensi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id_karyawan: karyawanId
                })
            });
            if (!response.ok) throw new Error(`Server Error (${response.status})`);
            const result = await response.json();

            // Tambahkan info verifikasi Python ke hasil
            result.python_verified = pythonVerified;
            result.python_score = pythonScore;
            result.python_engine = pythonEngine;

            console.log(`📋 [NODE.JS] Absensi ${karyawanId}: ${result.result_code} (Python: ${pythonEngine}, Score: ${pythonScore})`);
            return result;
        } catch (e) {
            if (e.name === 'TypeError' || e.message.includes('fetch')) {
                throw new Error("CONNECTION LOST: Server tidak merespon (ECONNRESET).");
            }
            throw e;
        }
    },
    getTodayAttendance: async () => { // Restored
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
    } // Restored
};

async function loadLabeledImages() {
    setStatusVisual('BOOT SEQUENCE: Memuat Database Wajah...', 'text-sky-400', true); // Restored
    if(dbStatus) {
        dbStatus.textContent = 'LOADING...';
        dbStatus.className = 'text-sky-400 font-bold';
    }
    logSystem('Database Sync Initiated.', 'text-sky-400'); // Restored
    
    try {
        const descriptorsData = await api.getDescriptors();
        // console.log("DEBUG SERVER DATA:", descriptorsData);
        logSystem(`DIAGNOSTIK: Diterima ${descriptorsData ? descriptorsData.length : 0} data dari server.`, 'text-sky-400'); // Restored
        
        if (!descriptorsData || descriptorsData.length === 0) {
            setStatusVisual(`⚠️ DB KOSONG. Mode Deteksi Saja.`, 'text-sky-400'); // Restored
            if(dbStatus) {
                dbStatus.textContent = 'EMPTY';
                dbStatus.className = 'text-sky-400 font-bold';
            }
            logSystem(`Database loaded: 0 records.`, 'text-sky-400');
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
            setStatusVisual(`⚠️ DB KOSONG. Mode Deteksi Saja.`, 'text-sky-400'); // Restored
            if(dbStatus) {
                dbStatus.textContent = 'EMPTY';
                dbStatus.className = 'text-sky-400 font-bold';
            }
            logSystem(`Database loaded: 0 records (Server Message).`, 'text-sky-400'); // Restored
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
    return; // Fungsi pemilihan perangkat dihapus.
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
    
    logSystem('Camera stream starting...', 'text-sky-400'); // Restored

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
    return; // Fungsi ganti kamera dihapus.
}

async function loadTodayAttendance() {
    if (!attendanceLog) return;
    try {
        const data = await api.getTodayAttendance();
        if (data && data.length > 0) {
            logSystem(`KERNEL DIAGNOSTIC: Loading ${data.length} records...`, 'text-sky-400');
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

let isAppInitialized = false;
async function initializeApp() {
    if (isAppInitialized) return;
    isAppInitialized = true;

    setStatusVisual('BOOT SEQUENCE: Loading Neural Engine...', 'text-sky-400', true);
    logSystem('Application boot sequence initiated.', 'text-sky-400');

    // [FIX] Suppress TensorFlow.js Backend/Platform Overwrite Warnings
    if (window.faceapi && faceapi.tf) {
        faceapi.tf.ENV.set('DEBUG', false);
        try { faceapi.tf.enableProdMode(); } catch (e) { }
    }

    try {
        // =====================================================================
        // [OPTIMIZED] PARALLEL BOOT: Model + Kamera + Data dimuat BERSAMAAN
        // Sebelumnya berurutan (model selesai → kamera → data).
        // Sekarang semua jalan paralel → boot time turun drastis.
        // =====================================================================
        const modelLoad = Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('./models')
        ]);

        // Muat BlazeFace PARALEL dengan model lain (tidak perlu tunggu)
        const blazeLoad = blazeface.load({ modelUrl: './models/blazeface/model.json' })
            .then(model => {
                blazeModel = model;
                logSystem('ENGINE: BLAZEFACE ACCELERATOR ONLINE', 'text-purple-400');
            })
            .catch(err => {
                console.warn('BlazeFace load failed, fallback mode.', err);
                logSystem('ENGINE: BLAZEFACE OFFLINE (Fallback)', 'text-orange-400');
            });

        // Muat konfigurasi server PARALEL (tidak bloking)
        const configLoad = api.getConfig()
            .then(configData => {
                if (configData && configData.success) {
                    SoundFX.elevenLabs.apiKey = configData.config.elevenlabs_api_key || SoundFX.elevenLabs.apiKey;
                    SoundFX.elevenLabs.voiceId = configData.config.elevenlabs_voice_id || SoundFX.elevenLabs.voiceId;
                    SoundFX.cfWorkerUrl = configData.config.cf_worker_tts_url || null;
                    logSystem(`VOICE MODULE: Sync OK (Voice: ${SoundFX.elevenLabs.voiceId.substring(0, 6)}...)`, 'text-purple-400');
                }
            })
            .catch(() => {});

        // Muat data absensi hari ini PARALEL (tidak bloking)
        const attendanceLoad = loadTodayAttendance().catch(() => {});

        // Tunggu model face-api selesai (WAJIB sebelum kamera bisa aktif)
        await modelLoad;
        logSystem('Neural Network Models Loaded.', 'text-green-500');
        setStatusVisual('Models Loaded. Starting Camera...', 'text-sky-400', true);

        // Kamera bisa start sekarang (tidak perlu tunggu blaze & config)
        await startCamera(null);

        // Tunggu sisanya di background (tidak bloking UI)
        Promise.all([blazeLoad, configLoad, attendanceLoad]).catch(() => {});

        // ONNX Runtime (opsional, tidak bloking)
        if (window.ort) {
            ort.env.wasm.wasmPaths = {
                'ort-wasm-simd.wasm': './node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm',
                'ort-wasm.wasm': './node_modules/onnxruntime-web/dist/ort-wasm.wasm'
            };
            ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
            ort.env.wasm.proxy = true;
        }

    } catch (err) {
        setStatusVisual(`❌ FATAL ERROR: Gagal Init Model. Cek folder /models.`, 'text-red-500');
        logSystem(`FATAL: Init failure. ${err.message}`, 'text-red-500');
    }
}

video.addEventListener('play', async () => {
    resizeCanvas();

    if (!labeledDescriptors) {
        // [OPTIMIZED] Load labeled images PARALEL — tidak bloking UI
        labeledDescriptors = await loadLabeledImages();
        videoContainer.classList.add('scanning-border');
    }

    resetTargetData();

    if (!isDetectionActive) {
        isDetectionActive = true;
        // [NEW] Reset adaptive counters saat detection dimulai
        currentDetectionInterval = DETECTION_INTERVAL_MS;
        consecutiveEmptyFrames   = 0;
        consecutiveFaceFrames    = 0;
        detectFaceLoop();
        setStatusVisual('SYSTEM READY. AWAITING TARGET...', 'text-gray-300', true);
        logSystem('Scanning Loop Activated [ADAPTIVE MODE].', 'text-green-500');
    }
});

// =========================================================================
// [NEW] ADAPTIVE DETECTION LOOP
// Logika: BlazeFace (ringan) jalan selalu.
// - Tidak ada wajah  → interval melambat (IDLE) untuk hemat CPU
// - Wajah muncul     → interval dipercepat (TURBO) untuk respons instan
// - face-api.js penuh hanya dijalankan dalam mode NORMAL & TURBO
// =========================================================================

// [OPTIMIZATION 2: TAB SLEEPER] 
// Prevent heavy AI calculations when the user minimizes the browser or switches tabs
let isTabActive = true;
document.addEventListener("visibilitychange", () => {
    isTabActive = !document.hidden;
    if (isTabActive) {
        console.log("[OPTIMIZATION] Tab active, waking up AI...");
    } else {
        console.log("[OPTIMIZATION] Tab hidden, pausing AI to save CPU/RAM...");
    }
});

async function detectFaceLoop() {
    if (!isTabActive) {
        // Just sleep for a second and check again later
        setTimeout(detectFaceLoop, 1000);
        return;
    }

    if (!isDetectionActive) return;

    // Cek cepat apakah ada wajah menggunakan BlazeFace sebelum jalankan face-api
    let facePresent = false;
    if (blazeModel && video.videoWidth > 0 && !video.paused) {
        try {
            const quickCheck = await blazeModel.estimateFaces(video, false);
            facePresent = quickCheck.length > 0;
        } catch (_) {
            facePresent = true; // Jika error, tetap jalankan deteksi penuh
        }
    } else {
        facePresent = true; // Fallback: selalu deteksi jika BlazeFace tidak tersedia
    }

    if (facePresent) {
        // ── Ada wajah: jalankan deteksi penuh + percepat interval
        consecutiveFaceFrames++;
        consecutiveEmptyFrames = 0;

        if (consecutiveFaceFrames >= FACE_TO_TURBO_THRESHOLD &&
            currentDetectionInterval !== DETECTION_INTERVAL_FAST) {
            currentDetectionInterval = DETECTION_INTERVAL_FAST;
            logSystem('⚡ TURBO MODE: Wajah terdeteksi — interval dipersingkat ke 50ms', 'text-cyan-300');
        }

        await detectFace(); // Jalankan face-api.js penuh

    } else {
        // ── Tidak ada wajah: lewati face-api, perlambat interval
        consecutiveEmptyFrames++;
        consecutiveFaceFrames = 0;

        if (consecutiveEmptyFrames >= EMPTY_TO_IDLE_THRESHOLD &&
            currentDetectionInterval !== DETECTION_INTERVAL_IDLE) {
            currentDetectionInterval = DETECTION_INTERVAL_IDLE;
            // Bersihkan canvas saat idle
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            handleNoFace(ctx); // Update status UI
        }
    }

    if (isDetectionActive) {
        setTimeout(detectFaceLoop, currentDetectionInterval);
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

// --- [NEW] FITUR: SCI-FI HUD RENDERER ---
function drawSciFiHUD(ctx, box, landmarks, color, label, status) {
    const { x, y, width, height } = box;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const time = Date.now() / 1000;
    const radius = Math.max(width, height) * 0.65;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    // 1. Cincin Luar Berputar (Terputus-putus)
    ctx.beginPath();
    const segments = 3;
    const segLen = (Math.PI * 2) / segments;
    for (let i = 0; i < segments; i++) {
        const start = (time * 0.5) + i * segLen; // Rotasi pelan
        const end = start + segLen * 0.4; // Celah antar segmen
        ctx.arc(cx, cy, radius, start, end);
    }
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2. Cincin Dalam Berlawanan Arah
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.85, -time, -time + Math.PI * 1.5);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 8]); // Garis putus-putus halus
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Bracket Sudut Taktis
    const bLen = 25;
    const bGap = 15; // Jarak dari wajah
    ctx.lineWidth = 1.5;
    
    // Gambar 4 Sudut
    const drawCorner = (px, py, dx, dy) => {
        ctx.beginPath();
        ctx.moveTo(px + (dx * bLen), py);
        ctx.lineTo(px, py);
        ctx.lineTo(px, py + (dy * bLen));
        ctx.stroke();
    };
    drawCorner(x - bGap, y - bGap, 1, 1);           // Kiri Atas
    drawCorner(x + width + bGap, y - bGap, -1, 1);  // Kanan Atas
    drawCorner(x + width + bGap, y + height + bGap, -1, -1); // Kanan Bawah
    drawCorner(x - bGap, y + height + bGap, 1, -1); // Kiri Bawah

    ctx.restore();
}

async function detectFace() {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    // [NEW] Gambar Lingkaran Target di Tengah Layar (Panduan Posisi)
    // [UPDATE] Gunakan status frame sebelumnya agar warna responsif
    // drawGuideOverlay(context, canvas.width, canvas.height, isLastFaceCentered); // Restored

    if (isProcessing) return; // Jangan lakukan apapun jika sedang memproses absensi
    if (video.paused || video.ended || !faceapi.nets.tinyFaceDetector.params || !labeledDescriptors) return;
    
    const displaySize = { width: canvas.width, height: canvas.height };

    // --- TEKNIK 3: CLAHE (NORMALISASI CAHAYA) ---
    if (!video.videoWidth) return;
    
    // [OPTIMIZATION 1: AUTO DOWNSCALE] Cap processing resolution to 640px max
    const scaleFactor = Math.min(1, 640 / video.videoWidth);
    offscreenCanvas.width = video.videoWidth * scaleFactor;
    offscreenCanvas.height = video.videoHeight * scaleFactor;

    // Normalisasi kontras agar fitur wajah tetap tajam meski cahaya redup
    offCtx.filter = 'brightness(1.1) contrast(1.2) saturate(1.0) grayscale(0.2)';
    offCtx.drawImage(video, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
    const aiInput = offscreenCanvas;

    let detections = null;

    // --- TEKNIK 1 & 2: ROI & FACE TRACKING ---
    if (blazeModel) {
        let searchArea = aiInput;

        // Jika wajah sebelumnya sudah terkunci (Tracking), kita bisa mempersempit area pencarian
        // Namun BlazeFace sangat cepat, jadi kita gunakan ia sebagai generator ROI utama
        const predictions = await blazeModel.estimateFaces(searchArea, false);

        if (predictions.length === 0) {
            lastFaceBox = null;
            trackingMissCount++;
            handleNoFace(context);
            return;
        }

        trackingMissCount = 0;
        const face = predictions[0];

        // ROI: Ambil koordinat box dari BlazeFace untuk membatasi kerja Face-API
        // Hal ini membuat identifikasi jauh lebih cepat karena AI tidak memindai seluruh background
        lastFaceBox = face.topLeft;

        // TAHAP IDENTIFIKASI (Hanya pada Single Face yang sudah dipastikan ada)
        // inputSize diatur ke 160 untuk kecepatan maksimal tanpa mengorbankan akurasi identitas
        detections = await faceapi.detectSingleFace(aiInput, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.45 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
    } else {
        // Fallback jika BlazeFace gagal
        detections = await faceapi.detectSingleFace(aiInput, new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
    }

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
        // [NEW] Tampilkan panel data dengan animasi slide-in
        const targetPanel = document.getElementById('target-data-panel');
        if (targetPanel) targetPanel.classList.remove('panel-hidden');

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const { box } = resizedDetections.detection;
        const { landmarks } = resizedDetections;

        // [DISABLED] AgeGenderNet & FaceExpressionNet dinonaktifkan untuk performa Absensi. // Restored
        const dominantEmotion = '-';
        const gender = '-';
        const age = '-';

        // --- FITUR: STABILISASI KAMERA (NO ZOOM) ---
        // Zoom dihapus agar resolusi tajam & orientasi stabil seperti HUD Taktis.
        video.style.transform = 'scaleX(-1)'; 

        // --- GAMBAR EFEK CANGGIH BARU ---

        // GAMBAR KONEKTOR BIOMETRIK (NEW)
        // drawBiometricConnectors(context, box, landmarks, '#DAA520'); // Restored

        // GAMBAR RETINAL SCAN (NEW)
        // drawRetinalScan(context, landmarks, '#DAA520'); // Restored

        // --- GAMBAR EFEK BARU ---
        // [UPDATE] Gunakan HUD Sci-Fi Baru yang lebih canggih di akhir frame
        
        // const nose = landmarks.getNose()[3]; // Titik tengah hidung
        // drawTargetLock(context, nose.x, nose.y, box.width * 0.3); // Diganti Sci-Fi HUD
        
        // --- EFEK SUARA: TARGET ACQUIRED ---
        if (!isTargetLocked) {
            SoundFX.play('robotic'); // [UPDATE] Gunakan efek suara robotik baru
            isTargetLocked = true;
        }

        // --- LOGIKA BARU: RECOGNITION DULU -> BARU LIVENESS ---
        // 1. Lakukan Pengenalan Wajah Terlebih Dahulu (Agar nama langsung muncul)
        let faceLabel = 'UNKNOWN';
        let faceColor = '#E2E8F0'; // Platinum/Silver
        let confidence = 0;
        let recognizedId = null;
        let employee = null;
        let bestMatch = null; // Define bestMatch scope

        // --- FILTER AKURASI TINGGI (STRICT MODE) --- // Restored
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
            faceLabel = 'DB OFFLINE'; // Restored
            faceColor = '#B59A72'; // Brushed Brass
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
        const scanProgress = maxCount / MIN_CONSENSUS;
        
        if (stabilizedLabel !== 'unknown' && maxCount >= MIN_CONSENSUS) {
            recognizedId = stabilizedLabel;
            
            // [NEW] Smart Locking: Simpan hasil valid & reset grace period
            lastStableResult = recognizedId;
            lockGraceCounter = 12; // Tahan hasil selama ~1.2 detik jika wajah goyang/hilang
            
            employee = employeeMap[recognizedId] || { nama: `ID:${recognizedId}`, jabatan: 'N/A' };
            faceLabel = employee.nama;
            faceColor = '#10B981'; // Mint Green (Match)
        } else {
            // [NEW] Grace Period Logic (Anti-Acak)
            // Jika hasil jadi unknown tapi kita punya lock baru-baru ini, pertahankan hasil lama sebentar
            if (lockGraceCounter > 0 && lastStableResult) {
                recognizedId = lastStableResult;
                lockGraceCounter--; // Kurangi durasi tahan
                
                employee = employeeMap[recognizedId] || { nama: `ID:${recognizedId}`, jabatan: 'N/A' };
                faceLabel = employee.nama; // Tetap tampilkan nama (Stabil)
                faceColor = '#10B981'; // Mint Green
            } else {
                // Benar-benar unknown atau grace period habis
                recognizedId = null;
                lastStableResult = null;
                
                if (maxCount > 1) {
                    faceLabel = "VERIFYING...";
                    faceColor = "#B59A72"; // Brushed Brass
                }
            }
        }

        // 2. Cek Liveness (Gerakan Kepala Challenge-Response) secara background

        // Update liveness detector dengan landmarks wajah saat ini
        if (window.LivenessCheck) {
            window.LivenessCheck.update(landmarks);
        }
        
        // [MODIFIED] Menonaktifkan liveness (selalu true). Hapus "true || " untuk mengaktifkan kembali.
        const isLive = true || (window.LivenessCheck ? window.LivenessCheck.isLive : true);

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
                if (ambStatus) { // Restored
                    ambStatus.textContent = 'DISPATCHED';
                    ambStatus.style.color = '#F59E0B';
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

            // [DISABLED] Emotion display dinonaktifkan (AgeGenderNet & FaceExpressionNet off)
            if(userEmotionDisplay) userEmotionDisplay.textContent = '-'; // Restored

            // CEK LIVENESS UNTUK EKSEKUSI
            if (isLive) {
                // SUDAH BERGERAK -> PROSES ABSEN
                userStatusDisplay.textContent = 'VERIFYING...';
                userStatusDisplay.className = 'text-lg font-bold text-sky-400';
                setSystemTheme('SUCCESS'); // Restored

                if (!isProcessing) { 
                    setStatusVisual(`AUTHORIZING ${employee.nama}...`, 'text-sky-400', true);
                    isProcessing = true;
                    // Simpan match terakhir sebelum proses absensi
                    lastKnownMatch = { id: recognizedId, box: resizedDetections.detection.box, landmarks: resizedDetections.landmarks, faceLabel: faceLabel, faceColor: faceColor };
                    
                    // [OPTIMIZATION] Downscale gambar sebelum dikirim ke server untuk mencegah lag
                    const MAX_WIDTH = 640;
                    let captureCanvas = offscreenCanvas;
                    if (offscreenCanvas.width > MAX_WIDTH) {
                        captureCanvas = document.createElement('canvas');
                        const scale = MAX_WIDTH / offscreenCanvas.width;
                        captureCanvas.width = MAX_WIDTH;
                        captureCanvas.height = offscreenCanvas.height * scale;
                        const ctx = captureCanvas.getContext('2d');
                        ctx.drawImage(offscreenCanvas, 0, 0, captureCanvas.width, captureCanvas.height);
                    }
                    const imageBase64 = captureCanvas.toDataURL('image/jpeg', 0.6);

                    if(window.LivenessCheck) window.LivenessCheck.reset(); // Reset status liveness
                    await processAttendance(recognizedId, imageBase64);
                }
            } else {
                // BELUM BERGERAK -> TAMPILKAN INSTRUKSI LIVENESS
                const remaining = window.LivenessCheck ? Math.max(0, Math.ceil((window.LivenessCheck.TIMEOUT_MS - (Date.now() - window.LivenessCheck.startTime)) / 1000)) : 0;
                
                if (window.LivenessCheck && window.LivenessCheck.baselineSet) {
                    setStatusVisual(`🛡️ GERAKKAN KEPALA SEDIKIT UNTUK VERIFIKASI (${remaining}s)`, 'text-yellow-400', true);
                } else {
                    setStatusVisual(`HALO ${employee.nama}. VERIFIKASI ANTI-SPOOFING...`, 'text-yellow-400', true);
                }
                userStatusDisplay.textContent = 'LIVENESS CHECK';
                userStatusDisplay.className = 'text-lg font-bold text-yellow-400 animate-pulse';
                setSystemTheme('SCANNING');
                
                // Gambar overlay instruksi liveness di canvas
                if (window.LivenessCheck) {
                    window.LivenessCheck.drawLivenessOverlay(context, box);
                }
                
                // Ubah warna HUD jadi Kuning (Waiting)
                faceColor = '#E6D0A8'; // Soft Gold for Liveness waiting
            }

        } else {
            // --- WAJAH TIDAK DIKENAL / DB OFFLINE ---
            resetTargetData();
            
            // [FIX] Cek apakah sedang dalam mode instruksi (Wajah terdeteksi tapi belum pas)
            // Jika faceLabel sudah berisi instruksi (misal "TAHAN POSISI"), jangan ditimpa jadi "UNKNOWN"
            
            // [NEW] Revert Ambulance Status
            const ambStatus = document.getElementById('amb-status');
            if (ambStatus && ambStatus.textContent !== '') {
                ambStatus.textContent = '';
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
                // Mode Unknown: Hilangkan efek merah, gunakan warna standar scanning (Cyan)
                videoContainer.classList.remove('scanning-border-error');
                if (labeledDescriptors && labeledDescriptors.length > 0) {
                    // Unknown Face
                    setStatusVisual('SCANNING..', 'text-sky-400');
                    userStatusDisplay.textContent = 'UNKNOWN TARGET';
                    faceLabel = 'UNKNOWN';
                    faceColor = '#B59A72'; // Brushed Brass for Unknown
                    
                    // Gunakan warna Cyan stabil untuk status Unknown
                    faceColor = '#B59A72'; // Restored

                    // Trigger Glitch Effect on Unknown Face (Interference)
                    if (Math.random() < 0.15) triggerGlitch();
                } else {
                    // DB Offline
                    setStatusVisual('WARNING: NO BIOMETRIC DATABASE FOUND.', 'text-sky-400');
                    userStatusDisplay.textContent = 'OFFLINE';
                }
            }
            
            if(userEmotionDisplay) userEmotionDisplay.textContent = '-';
            targetLabel = '';
            lastKnownMatch = null; // Restored
        }
        
        // drawTechBracket(context, box.x, box.y, box.width, box.height, faceColor); // Diganti Sci-Fi HUD
        // drawTacticalHUD(context, box, faceColor);
        // [UPDATE] Override HUD dengan status & warna terkini
        drawSciFiHUD(context, box, landmarks, faceColor, faceLabel, userStatusDisplay.textContent);
        
        // Draw Progress Ring (Visual Feedback Kunci)
        drawBiometricProgress(context, box, scanProgress, faceColor);

        drawSmartHUD(context, box, faceLabel, faceColor, confidence, dominantEmotion, gender, age);

        // [DISABLED - CPU OPTIMIZATION] Efek berat dinonaktifkan untuk performa Absensi: // Restored
        // drawHolographicMesh  -> 68-titik triangulasi, sangat berat // Restored
        // drawFaceShape        -> gambar ulang outline wajah tiap frame // Restored
        // drawEyeParticles     -> sistem partikel aktif setiap frame // Restored
        // triggerGlitch random -> overhead tidak perlu // Restored

    } else {
        handleNoFace(context);
    }
}

// [NEW] Fungsi helper untuk menangani kondisi Standby (Tidak ada wajah)
function handleNoFace(context) {
    if (window.LivenessCheck) window.LivenessCheck.reset();
    resetTargetData();

    // [NEW] Sembunyikan panel data dengan animasi slide-out
    const targetPanel = document.getElementById('target-data-panel');
    if (targetPanel) targetPanel.classList.add('panel-hidden');

    const ambStatus = document.getElementById('amb-status');
    if (ambStatus && ambStatus.textContent !== '') {
        ambStatus.textContent = '';
        ambStatus.style.color = '#FF3333';
        ambStatus.style.textShadow = '0 0 10px #FF0000';
    }

    isTargetLocked = false;
    updateSystemDiagnostics(0);
    if (recognitionHistory.length > 0) recognitionHistory.shift();

    video.style.transform = 'scaleX(-1)';
    setStatusVisual('SYSTEM READY. AWAITING TARGET...', 'text-gray-300', true);
    confidenceHistory = [];
    faceParticles = [];
    if (userEmotionDisplay) userEmotionDisplay.textContent = '-';
    targetLabel = '';
    setSystemTheme('IDLE');
    lastKnownMatch = null; // Restored
    isLastFaceCentered = false;
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

async function processAttendance(karyawanId, imageBase64) {
    logSystem(`Sending attendance request for ID: ${karyawanId}`, 'text-sky-400');

    if(successOverlay) {
        successOverlay.style.opacity = 0;
        successOverlay.style.pointerEvents = 'none';
        
        // INIT OVERLAY BARU
        // Menggunakan style holo-card sederhana untuk loading
        successOverlay.innerHTML = `
            <div class="holo-card" style="border-color: ${HEADER_COLOR}; text-align: center; justify-content: center; backdrop-filter: blur(20px);">
                <div class="holo-header" style="justify-content: center;">
                    <span class="text-emerald-200 font-mono tracking-[0.5em] text-2xl animate-pulse font-bold">MENGHUBUNGKAN SERVER...</span>
                </div>
                <div class="p-20 flex flex-col items-center justify-center h-full">
                    <h1 class="text-6xl font-black text-white mb-8 tracking-widest glitch-text">MEMPROSES BIOMETRIK</h1>
                    <div class="w-full bg-emerald-950 h-1 mt-4 rounded overflow-hidden">
                        <div class="h-full bg-emerald-400 animate-[loading_1s_infinite]"></div>
                    </div>
                </div>
            </div>
        `;
        successOverlay.style.background = `rgba(4, 30, 20, 0.9)`;
        successOverlay.style.opacity = 1;
    }

    try {
        // [MODIFIKASI] Buat jeda minimal 1 detik untuk animasi "MEMPROSES BIOMETRIK"
        const [result] = await Promise.all([
            api.postAttendance(karyawanId, imageBase64),
            new Promise(r => setTimeout(r, 500)) // Reduced to 0.5 seconds to accelerate the "MEMPROSES BIOMETRIK" screen.
        ]);
        
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
        if (!result.success && result.result_code === 'TOO_EARLY_OUT') {
            if (userScanCounters[karyawanId] <= 2) {
                result.success = true;
                result.result_code = 'ALREADY_IN_CONFIRMATION';
                result.statusColor = 'green';
                result.message = 'Absensi Masuk Sudah Terkonfirmasi.';
            }
        }

        const serverTimestamp = new Date().toLocaleTimeString('id-ID');

        const statusColor = result.statusColor || 'red';
        const displayColor = (statusColor === 'green' ? 'text-green-500' : (statusColor === 'yellow' ? 'text-sky-400' : 'text-red-500'));
        
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
            cornerProfileCard.style.borderColor = result.success ? '#F59E0B' : '#FF0055';
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
            SoundFX.play('success'); // Restored
            showToast(cleanMessage, 'success'); // [NEW] Toast Notification
            
            // [NEW] Sapaan Waktu Otomatis
            const hour = new Date().getHours();
            let timeGreeting = 'Pagi';
            if (hour >= 11 && hour < 15) timeGreeting = 'Siang';
            else if (hour >= 15 && hour < 19) timeGreeting = 'Sore';
            else if (hour >= 19 || hour < 4) timeGreeting = 'Malam';
            
            // [UPDATE] Logika Pesan Suara Baku & Formal
            if (result.result_code === 'CHECK_OUT_SUCCESS') {
                const pswMenit = result.psw_menit || 0;
                if (pswMenit > 0) {
                    SoundFX.speak(`Perhatian, ${display_name} Anda tercatat meninggalkan kantor lebih awal ${pswMenit} menit. Mohon untuk selalu disiplin terhadap waktu kerja.`);
                } else {
                    SoundFX.speak(`Sampai jumpa, ${display_name}. Data kehadiran pulang atas nama ${display_name} berhasil dicatat. terima kasih.`);
                }
            } else if (result.result_code === 'ALREADY_CHECKED_IN' || result.result_code === 'ALREADY_IN_CONFIRMATION') {
                let jamMasukAudio = result.jam_masuk || '';
                if (!jamMasukAudio && result.message) {
                    const matchAudio = result.message.match(/(?:pukul|jam)\s+([0-9:]+)/i);
                    if (matchAudio) jamMasukAudio = matchAudio[1];
                }
                if (jamMasukAudio) {
                    SoundFX.speak(`${display_name}, Anda sudah melakukan absen masuk pada jam ${jamMasukAudio}.`);
                } else {
                    SoundFX.speak(`${display_name}, Anda sudah melakukan absen masuk sebelumnya.`);
                }
            } else {
                if (result.telat_menit > 0) {
                    SoundFX.speak(`${display_name}, Anda terlambat ${result.telat_menit} menit. Mohon lebih disiplin lagi besok.`);
                } else {
                    SoundFX.speak(`Selamat datang di Puskesmas Wana, ${display_name}. Data kehadiran masuk atas nama ${display_name} berhasil dicatat. terima kasih.`);
                }
            }
            
            setSystemTheme('SUCCESS'); // Theme Green // Restored
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
                        finalMessageHTML = `<div style="font-size: 1.1rem; opacity: 0.9; margin-bottom: 5px;">Absensi masuk tetap dicatat.</div><span style="font-weight:950; font-size: 2.8rem; line-height: 1.1; display:block; margin-top:10px; text-shadow: 0 1px 0 #555, 0 2px 0 #444, 0 10px 20px rgba(0,0,0,0.5); transform: perspective(500px) rotateX(15deg); letter-spacing: 2px;">+ ${result.telat_menit} MENIT</span>`;
                        finalStatusColor = '#10B981'; // Diubah dari Kuning Emas menjadi Hijau
                        finalBackground = ABSEN_NORMAL_BG;
                    } else {
                        finalStatusText = 'TEPAT WAKTU';
                        finalStatusText = 'ABSEN MASUK BERHASIL';
                        finalMessageHTML = `<div style="font-size: 1.1rem; opacity: 0.9; margin-bottom: 5px;">Absensi MASUK Terkonfirmasi.</div><span style="font-weight:950; font-size: 2.2rem; display:block; margin-top:10px; text-shadow: 0 1px 0 #555, 0 2px 0 #444, 0 10px 20px rgba(0,0,0,0.5); transform: perspective(500px) rotateX(15deg); letter-spacing: 4px;">SELAMAT BEKERJA</span>`; // Restored
                        finalBackground = ABSEN_NORMAL_BG;
                        finalStatusColor = '#10B981'; // Hijau Spring
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
                        finalMessageHTML = `<span style="font-weight:bold; text-shadow: 0 0 15px rgba(255,255,255,0.3);">${cleanMessage}</span>`; // Restored
                        finalStatusColor = '#10B981'; // Diubah dari Kuning Emas menjadi Hijau
                        finalBackground = ABSEN_NORMAL_BG;
                    } else {
                        finalStatusText = 'CHECK-OUT BERHASIL';
                        finalMessageHTML = `<div style="font-size: 1.1rem; opacity: 0.9; margin-bottom: 5px;">Absensi PULANG Terkonfirmasi.</div><span style="font-weight:900; font-size: 1.8rem; text-shadow: 0 1px 0 #555, 0 2px 0 #444, 0 10px 20px rgba(0,0,0,0.5);">Hati-hati di jalan.</span>`; // Restored
                        finalStatusColor = '#10B981'; // Hijau Spring (Sama seperti Check-In)
                        finalBackground = ABSEN_NORMAL_BG;
                    }
                    logAttendance(display_name, serverTimestamp); // Log ke panel kanan
                    updatePersonnelRoster(); // Refresh Roster Visual
                    break;
                case 'ALREADY_IN_CONFIRMATION':
                    finalStatusText = 'SUDAH ABSEN MASUK';
                    finalMessageHTML = `<span style="font-weight:950; font-size: 2rem; text-shadow: 0 1px 0 #555, 0 2px 0 #444, 0 10px 20px rgba(0,0,0,0.5);">DATA TERKONFIRMASI</span><br><span style="font-size: 1.1rem; opacity: 0.8;">Anda sudah melakukan absen masuk.</span>`;
                    finalBackground = ABSEN_NORMAL_BG; // Restored
                    finalStatusColor = '#10B981';
                    break;
                case 'STATUS_CONFIRMED':
                default: // Fallback untuk kasus sukses lainnya
                    finalStatusText = 'STATUS TERKONFIRMASI';
                    finalMessageHTML = `Identitas Terkonfirmasi.<br>Data telah disimpan.`;
                    finalBackground = ABSEN_NORMAL_BG;
                    finalStatusColor = NAME_HIGHLIGHT_COLOR; 
            }

            // --- [NEW] ANIMASI KARTU POPUP DI TENGAH ATAS KAMERA ---
            const centerSuccessPopup = document.getElementById('centerSuccessPopup');
            if (centerSuccessPopup) {
                const photoSrc = employeeData.foto ? `data:image/jpeg;base64,${employeeData.foto}` : 'logo.jpg'; // Restored
                const statusColorPop = result.result_code === 'CHECK_IN_SUCCESS' || result.result_code === 'ALREADY_IN_CONFIRMATION' ? 'bg-[#10B981]' : 'bg-[#f43f5e]';
                const glowColorPop = result.result_code === 'CHECK_IN_SUCCESS' || result.result_code === 'ALREADY_IN_CONFIRMATION' ? '#10B981' : '#f43f5e';
                
                centerSuccessPopup.innerHTML = `
                    <div class="flex items-center p-4 rounded-xl border border-emerald-600/50 bg-emerald-900/95 backdrop-blur-xl shadow-[0_15px_40px_rgba(0,0,0,0.5),0_0_20px_${glowColorPop}40] overflow-hidden relative w-full">
                        <div class="absolute left-0 top-0 bottom-0 w-[5px] z-20" style="background-color: ${glowColorPop}; box-shadow: 0 0 10px ${glowColorPop};"></div>
                        <div class="absolute -inset-[2px] rounded-xl bg-gradient-to-br from-sky-400 via-emerald-800 to-emerald-950 opacity-50 z-0"></div>
                        <div class="absolute inset-0 rounded-[10px] bg-emerald-950 z-0"></div>
                        <div class="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%] animate-[shine_2s_linear_infinite] z-20 pointer-events-none"></div>
 
                        <div class="relative w-[72px] h-[72px] flex-shrink-0 z-10 ml-3 shadow-[0_0_15px_${glowColorPop}40] rounded-[12px]">
                            <img src="${photoSrc}" class="w-full h-full rounded-[12px] object-cover border-2 border-white/30">
                            <div class="absolute -bottom-2 -right-2 w-5 h-5 ${statusColorPop} rounded-full border-2 border-emerald-950 shadow-[0_0_8px_${glowColorPop}] z-40 flex items-center justify-center">
                                <i class="fa-solid fa-check text-[10px] text-white"></i>
                            </div>
                        </div>
 
                        <div class="flex-grow min-w-0 z-10 ml-5">
                            <p class="font-extrabold text-[17px] text-white truncate leading-tight tracking-wider" style="text-shadow: 0 2px 5px rgba(0,0,0,0.5);">${display_name}</p>
                            <p class="text-[11px] text-emerald-300 font-extrabold truncate mb-2 uppercase tracking-[0.2em]">${display_jabatan}</p>
                            
                            <div class="inline-block bg-emerald-800/80 px-3 py-1.5 rounded-lg border border-emerald-600/40 mt-1">
                                <p class="text-[12px] font-black tracking-widest text-white leading-none"><span style="color: ${glowColorPop}; text-shadow: 0 0 8px ${glowColorPop};">${finalStatusText}</span></p>
                            </div>
                        </div>
                    </div>
                `;

                // Tampilkan Popup
                centerSuccessPopup.style.opacity = '1';
                centerSuccessPopup.style.transform = 'translate(-50%, 0) scale(1.05)';
                setTimeout(() => {
                    centerSuccessPopup.style.transform = 'translate(-50%, 0) scale(1)';
                }, 300);

                // Sembunyikan setelah 4 detik
                setTimeout(() => {
                    centerSuccessPopup.style.opacity = '0';
                    centerSuccessPopup.style.transform = 'translate(-50%, -48px) scale(0.8)';
                }, 4000);
            }

            // UPDATE DIAGNOSTIC PANEL (Full Name List)
            if (diagnosticList) {
                // Hapus placeholder jika ada
                if (diagnosticList.querySelector('.italic')) diagnosticList.innerHTML = '';

                const diagItem = document.createElement('div');
                diagItem.className = 'flex justify-between items-center bg-gray-800/50 p-2 rounded border-l-2 border-green-500 animate-[fadeIn_0.5s_ease-out]';
                diagItem.innerHTML = `
            <div class="flex flex-col overflow-hidden"><span class="text-amber-300 font-bold text-xs break-words leading-tight" title="${display_name}">${display_name}</span><span class="text-[9px] text-gray-400 mt-0.5">${display_jabatan}</span></div>
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
            showToast(cleanMessage, isWarning ? 'warning' : 'error'); // [NEW] Toast Notification

            // --- UPDATE: Penanganan Overlay Spesifik Berdasarkan Kode Server ---
            switch (result.result_code) {
                case 'OUT_OF_TIME_IN':
                    finalStatusText = 'DILUAR JAM MASUK';
                    // Pesan dari server sudah mengandung jam dari .env (misal: "Waktu diizinkan: 07:00 s/d 11:00")
                    finalMessageHTML = `<span>${cleanMessage}</span>`; 
                    break;
                case 'TOO_EARLY_OUT':
                    finalStatusText = 'DILUAR JAM PULANG';
                    finalMessageHTML = `<span style="font-weight:950; font-size: 1.8rem; text-shadow: 0 1px 0 #555, 0 2px 0 #444, 0 10px 20px rgba(0,0,0,0.5);">${cleanMessage}</span>`; 
                    break;
                case 'ALREADY_CHECKED_IN':
                    finalStatusText = 'SUDAH ABSEN MASUK';
                    // Ambil data absen yang sudah ada jam berapa
                    let jamMasuk = result.jam_masuk || '';
                    if (!jamMasuk && result.message) {
                        const match = result.message.match(/pukul\s+([0-9:]+)/);
                        if (match) jamMasuk = match[1];
                    }
                    if (!jamMasuk && result.message) {
                        const match2 = result.message.match(/jam\s+([0-9:]+)/);
                        if (match2) jamMasuk = match2[1];
                    }
                    if (!jamMasuk) {
                        jamMasuk = '--:--';
                    }
                    finalMessageHTML = `<span style="font-weight:950; font-size: 1.8rem; text-shadow: 0 1px 0 #555, 0 2px 0 #444, 0 10px 20px rgba(0,0,0,0.5);">Peringatan!<br>Anda sudah absen masuk jam ${jamMasuk}</span>`;
                    break;
                case 'ALREADY_CHECKED_OUT':
                    finalStatusText = 'SUDAH PULANG';
                    finalMessageHTML = `<span style="font-weight:950; font-size: 1.8rem; text-shadow: 0 1px 0 #555, 0 2px 0 #444, 0 10px 20px rgba(0,0,0,0.5);">${cleanMessage}</span>`;
                    break;
                default:
                    finalStatusText = isWarning ? 'PERINGATAN' : 'AKSES DITOLAK';
                    finalMessageHTML = `<span style="font-weight:950; font-size: 2rem; display:block; margin-top:10px; text-shadow: 0 1px 0 #555, 0 2px 0 #444, 0 10px 20px rgba(0,0,0,0.5);">${cleanMessage}</span>`;
            }

            // VISUAL UPDATES (Dipindahkan ke sini agar override isWarning di switch berlaku)
            SoundFX.play('error');
            let warningSpeakText = isWarning ? `Peringatan, ${display_name}` : `Akses Ditolak, ${display_name}`;
            if (result.result_code === 'ALREADY_CHECKED_IN') {
                // [UPDATE] Logika Dinamis sebelum dan sesudah jam 11:00
                const currentHour = new Date().getHours();
                
                if (currentHour < 11) {
                    // Sebelum jam 11:00
                    let jamMasukPendek = result.jam_masuk ? result.jam_masuk.substring(0, 5) : '';
                    if (!jamMasukPendek && result.message) {
                        const match = result.message.match(/pukul\s+([0-9:]+)/);
                        if (match) jamMasukPendek = match[1].substring(0, 5);
                    }
                    if (jamMasukPendek) {
                        warningSpeakText = `Maaf ${display_name}, Anda sudah absen masuk pada jam ${jamMasukPendek}.`;
                    } else {
                        warningSpeakText = `Maaf ${display_name}, Anda sudah absen masuk.`;
                    }
                } else {
                    // Lewat jam 11:00 tapi masih sebelum BATAS_MIN_PULANG
                    if (result.batas_min_pulang) {
                        let jamPulangBuka = result.batas_min_pulang.substring(0, 5);
                        warningSpeakText = `Maaf ${display_name}, absen pulang cepat atau PSW dibuka jam ${jamPulangBuka}.`;
                    } else {
                        warningSpeakText = `${display_name}, Anda sudah absen masuk.`;
                    }
                }
            } else if (result.result_code === 'OUT_OF_TIME_IN') {
                warningSpeakText = `Maaf ${display_name} absen masuk ditolak karena diluar jam operasional,`;
                if (result.jam_masuk_start) {
                    let jamMasukBuka = result.jam_masuk_start.substring(0, 5);
                    warningSpeakText += ` absen masuk dibuka jam ${jamMasukBuka}.`;
                }
            } else if (result.result_code === 'ALREADY_CHECKED_OUT') {
                let jamPulangPendek = result.jam_pulang ? result.jam_pulang.substring(0, 5) : '';
                if (!jamPulangPendek && result.message) {
                    const match = result.message.match(/pukul\s+([0-9:]+)/);
                    if (match) jamPulangPendek = match[1].substring(0, 5);
                }
                if (!jamPulangPendek && result.message) {
                    const match2 = result.message.match(/jam\s+([0-9:]+)/);
                    if (match2) jamPulangPendek = match2[1].substring(0, 5);
                }
                
                if (jamPulangPendek) {
                    warningSpeakText = `Peringatan ${display_name}, Anda sudah absen pulang pada jam ${jamPulangPendek}.`;
                } else {
                    warningSpeakText = `Peringatan ${display_name}, Anda sudah absen pulang.`;
                }
            }
            await SoundFX.speak(warningSpeakText);
            setSystemTheme('ERROR'); // Restored

            setStatusVisual(`${display_name}: ${cleanMessage}`, isWarning ? 'text-sky-400' : 'text-red-500');
            userStatusDisplay.textContent = isWarning ? 'NOTICE' : 'DENIED';
            userStatusDisplay.className = 'text-lg font-bold ' + (isWarning ? 'text-sky-400' : 'text-red-500');

            // Background: Kuning untuk Warning (Waktu), Merah untuk Error (Wajah Tidak Dikenal)
            finalBackground = isWarning 
                ? `radial-gradient(circle, rgba(255, 215, 0, 0.8) 0%, rgba(100, 80, 0, 0.95) 100%)`
                : `radial-gradient(circle, rgba(255, 0, 85, 0.8) 0%, rgba(100, 0, 0, 0.95) 100%)`;
            
            finalStatusColor = isWarning ? '#FFD700' : '#FF0055';
        }

        // --- GENERATE VISUAL EFFECTS (From Admin ID Card) ---
        // Generate random QR blocks
        const qrBlocks = Array(25).fill(0).map(() => 
            `<div class="w-full h-full bg-emerald-950/50 ${Math.random() > 0.5 ? 'bg-emerald-400' : 'opacity-20'}"></div>`
        ).join('');

        // Generate floating digital particles
        const particles = Array(20).fill(0).map(() => {
            const left = Math.random() * 100;
            const top = Math.random() * 100;
            const delay = Math.random() * 5;
            const duration = Math.random() * 3 + 2;
            const size = Math.random() * 3 + 1;
            return `<div class="absolute bg-emerald-400 rounded-sm opacity-0" style="left: ${left}%; top: ${top}%; width: ${size}px; height: ${size}px; animation: float-particle ${duration}s linear infinite; animation-delay: -${delay}s; box-shadow: 0 0 4px #e0f2fe;"></div>`;
        }).join('');

        // --- NEW: LOGIKA WARNA & ICON STATUS (CUSTOMIZATION) ---
        // Membedakan warna Nama & Box berdasarkan hasil
        // FIX: Jika statusColor kuning (PSW), nama juga ikut kuning meskipun success=true
        let finalNameColor = statusColor === 'green' ? '#e0f2fe' : (statusColor === 'yellow' ? '#f97316' : '#FF0055'); // Restored
        
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
            const guillocheSvg = `<svg width='100' height='100' xmlns='http://www.w3.org/2000/svg'><path d='M 0,50 C 25,0 75,100 100,50 M 0,50 C 25,100 75,0 100,50' stroke='${finalStatusColor}' stroke-width='0.5' fill='none' opacity='0.2'/><path d='M 50,0 C 0,25 100,75 50,100 M 50,0 C 100,25 0,75 50,100' stroke='${finalStatusColor}' stroke-width='0.5' fill='none' opacity='0.2'/></svg>`; // Restored
            const watermarkSvg = `<svg width='300' height='300' xmlns='http://www.w3.org/2000/svg'><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='"Times New Roman", serif' font-size='30' font-weight='bold' fill='${finalStatusColor}' opacity='0.06' transform='rotate(-45 150 150)'>PUSKESMAS WANA</text></svg>`;

            // [IDE BARU] DNA Pulse Curve with Glitch & Color Shift (God-Level Custom)
            const dnaHelixStampHTML = `
            <div class="dna-helix-container" style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 100px; height: 100%; opacity: 0.6; z-index: 0; pointer-events: none;">
                ${Array.from({length: 50}, (_, i) => `
                    <div class="dna-base" style="top: ${i * 12}px; animation-delay: -${i * 0.15}s;">
                        
                        <div class="line" style="background: linear-gradient(90deg, ${finalStatusColor}, transparent, ${finalStatusColor}); height: 1px; opacity: 0.4;"></div>
                        <div class="dot right" style="background: ${finalStatusColor}; box-shadow: 0 0 10px ${finalStatusColor};"></div>
                    </div>
                `).join('')}
            </div>
            `;

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
                        <!-- Elegant Dark Texture -->
                        <div class="id-card-bg-layer" style="background-color: #1A1C20; background-image: radial-gradient(circle at 50% 0%, #2A2D34 0%, #0D0E10 100%); opacity: 1;"></div>
                        <div class="id-card-bg-layer" style="background-image: url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(hexGridSvg)}'); animation: hex-pan 60s linear infinite; opacity: 0.05;"></div>
                    </div>
                    <div class="id-card-content" style="border: 1px solid rgba(255, 215, 0, 0.2); box-shadow: 0 20px 60px rgba(0,0,0,0.8);">
                        
                        <!-- Luxury Prismatic Chip -->
                        <div class="absolute top-32 right-6 w-12 h-9 bg-gradient-to-br from-[#B8860B] via-[#FFD700] to-[#B8860B] rounded-md border border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.3)] z-20 overflow-hidden" style="background-image: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(0,0,0,0.2) 100%), linear-gradient(to right, #B8860B, #FFD700);">
                            <div class="absolute top-1/2 left-0 w-full h-[1px] bg-black/30"></div>
                            <div class="absolute left-1/3 top-0 w-[1px] h-full bg-black/30"></div>
                            <div class="absolute left-2/3 top-0 w-[1px] h-full bg-black/30"></div>
                            <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-black/20 rounded-sm"></div>
                        </div>

                        <!-- Header: Carbon Black Metallic -->
                        <div class="relative h-28 flex items-center px-6 overflow-hidden border-b-2 border-[#FFD700]/50" style="background: linear-gradient(to bottom, #000000, #0a0a0a); box-shadow: inset 0 -5px 10px rgba(0,0,0,0.8);">
                            <!-- Subtle carbon pattern for header -->
                            <div class="absolute inset-0 opacity-10" style="background-image: repeating-linear-gradient(45deg, #FFD700 0, #FFD700 1px, transparent 0, transparent 5px); background-size: 10px 10px;"></div>
                            
                            <div class="w-14 h-14 rounded-full flex items-center justify-center border border-[#FFD700]/40 mr-5 shadow-[0_0_20px_rgba(255,215,0,0.15)] bg-black relative z-10">
                                <img src="logo.jpg" class="w-full h-full object-cover rounded-full opacity-90">
                            </div>
                            <div class="z-10">
                                <h2 class="text-xl font-black text-white tracking-wider uppercase leading-none whitespace-nowrap" style="font-family: 'Times New Roman', serif; text-shadow: 2px 2px 0px #000;">PUSKESMAS WANA</h2>
                                <div class="flex items-center gap-2 mt-2">
                                    <div class="h-[2px] w-8 bg-[#FFD700]"></div>
                                    <p class="text-[11px] text-[#FFD700] tracking-[0.3em] uppercase font-black" style="text-shadow: 1px 1px 0px #000;">KARTU IDENTITAS PEGAWAI</p>
                                </div>
                            </div>
                        </div>

                        <!-- Body -->
                        <div class="p-6 flex gap-6 items-start relative">
                            <!-- Photo Frame -->
                            <div class="relative w-32 h-40 flex-shrink-0">
                                <div class="w-full h-full p-[2px] bg-gradient-to-b from-[#FFD700] to-[#B8860B] rounded-lg shadow-2xl relative">
                                    <div class="w-full h-full rounded-md overflow-hidden bg-black relative">
                                        <img src="${employeeData.foto ? `data:image/jpeg;base64,${employeeData.foto}` : ''}" class="w-full h-full object-cover filter contrast-110" onerror="this.style.display='none'">
                                        <!-- Hologram Overlay on Photo -->
                                        <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-[#FFD700]/10 to-transparent opacity-40"></div>
                                    </div>
                                </div>
                                <div class="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-black border border-[#FFD700] px-3 py-0.5 rounded-full shadow-lg z-20">
                                    <span class="text-[9px] font-black text-[#FFD700] tracking-widest">VERIFIED</span>
                                </div>
                            </div>

                            <!-- Info -->
                            <div class="flex-1 flex flex-col justify-between h-40 py-1 relative z-10">
                                <div>
                                    <p class="text-[11px] text-gray-300 uppercase tracking-widest mb-1 font-black" style="text-shadow: 1px 1px 0px #000;">Nama Pegawai</p>
                                    <h1 class="text-3xl font-black text-white leading-tight mb-3 tracking-wide" style="font-family: 'Arial', sans-serif; text-shadow: 2px 2px 0px #000;">${display_name}</h1>
                                    
                                    <p class="text-[11px] text-gray-300 uppercase tracking-widest mb-1 font-black" style="text-shadow: 1px 1px 0px #000;">Jabatan</p>
                                    <p class="text-lg font-black text-[#FFD700] tracking-wider border-l-4 border-[#FFD700] pl-3" style="text-shadow: 1px 1px 0px #000;">${display_jabatan}</p>
                                </div>

                                <!-- Digital Signature Overlay -->
                                <div class="absolute bottom-10 right-0 opacity-40 pointer-events-none rotate-[-5deg]">
                                    <svg width="100" height="40" viewBox="0 0 100 40" fill="none" stroke="#FFD700" stroke-width="1.5">
                                        <path d="M10 30 Q30 5 50 25 T90 15" stroke-linecap="round" />
                                        <path d="M20 35 Q40 15 60 30" stroke-linecap="round" opacity="0.5" />
                                    </svg>
                                    <p class="text-[6px] text-[#FFD700] text-center uppercase tracking-tighter">Verified Authority</p>
                                </div>
                                
                                <div class="mt-auto pt-3 border-t-2 border-white/20 flex justify-between items-end">
                                    <div> 
                                        <p class="text-[11px] text-gray-300 uppercase tracking-wider font-black" style="text-shadow: 1px 1px 0px #000;">ID Number</p>
                                        <p class="text-3xl font-mono text-white tracking-widest font-black" style="text-shadow: 2px 2px 0px #000;">${karyawanId}</p>
                                    </div>
                                    <!-- Realistic Barcode -->
                                    <div class="flex flex-col items-end opacity-90">
                                        <div class="bg-white px-2 py-1 rounded-sm flex flex-col items-center relative overflow-hidden">
                                            <div class="h-8 w-24" style="background: linear-gradient(90deg, 
                                                #000 2%, transparent 2%, transparent 4%, #000 4%, #000 5%, transparent 5%, transparent 6%, #000 6%, #000 9%, transparent 9%, transparent 10%, 
                                                #000 10%, #000 12%, transparent 12%, transparent 14%, #000 14%, #000 18%, transparent 18%, transparent 19%, #000 19%, #000 20%, transparent 20%, transparent 22%, 
                                                #000 22%, #000 24%, transparent 24%, transparent 26%, #000 26%, #000 29%, transparent 29%, transparent 30%, #000 30%, #000 32%, transparent 32%, transparent 36%, 
                                                #000 36%, #000 38%, transparent 38%, transparent 40%, #000 40%, #000 42%, transparent 42%, transparent 44%, #000 44%, #000 48%, transparent 48%, transparent 50%, 
                                                #000 50%, #000 52%, transparent 52%, transparent 54%, #000 54%, #000 58%, transparent 58%, transparent 60%, #000 60%, #000 64%, transparent 64%, transparent 66%, 
                                                #000 66%, #000 68%, transparent 68%, transparent 70%, #000 70%, #000 74%, transparent 74%, transparent 76%, #000 76%, #000 78%, transparent 78%, transparent 80%, 
                                                #000 80%, #000 82%, transparent 82%, transparent 84%, #000 84%, #000 86%, transparent 86%, transparent 88%, #000 88%, #000 92%, transparent 92%, transparent 94%, 
                                                #000 94%, #000 96%, transparent 96%, transparent 98%, #000 98%);"></div>
                                            
                                            <!-- Hologram Overlay -->
                                            <div class="absolute inset-0" style="background: linear-gradient(115deg, transparent 30%, rgba(0,255,255,0.3) 40%, rgba(255,0,255,0.3) 50%, rgba(255,255,0,0.3) 60%, transparent 70%); background-size: 200% 100%; animation: holo-bar 3s linear infinite; mix-blend-mode: multiply;"></div>
                                            
                                            <p class="text-[7px] font-mono font-bold text-black tracking-[0.2em] leading-none mt-0.5 relative z-10">${karyawanId}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div class="h-10 flex items-center justify-center px-6 overflow-hidden relative border-t-2 border-[#FFD700]/50" style="background: linear-gradient(to bottom, #0a0a0a, #000000); box-shadow: inset 0 5px 10px rgba(0,0,0,0.8);">
                            <!-- Subtle carbon pattern for footer -->
                            <div class="absolute inset-0 opacity-10" style="background-image: repeating-linear-gradient(45deg, #FFD700 0, #FFD700 1px, transparent 0, transparent 5px); background-size: 10px 10px;"></div>
                            
                            <span class="text-[11px] text-[#FFD700] tracking-[0.25em] font-serif uppercase relative z-10 font-black" style="text-shadow: 1px 1px 0px #000;">KARTU INI MILIK UPTD PUSKESMAS WANA</span>
                        </div>
                    </div>
                </div>
            `;
            // Latar belakang dikembalikan ke mode high-tech gelap (agar rumus fisika & nadi terlihat kontras)
            successOverlay.style.backgroundImage = 'linear-gradient(rgba(5, 10, 20, 0.8), rgba(0, 0, 0, 0.95)), url("medis.jpg")';
            successOverlay.style.backgroundSize = 'cover'; // Restored
            successOverlay.style.backgroundPosition = 'center';
            successOverlay.style.backgroundRepeat = 'no-repeat';
            successOverlay.innerHTML = `
                <style>
                    .shutter-layer {
                        position: fixed; inset: 0; z-index: 9999;
                        display: flex; justify-content: center; align-items: center;
                        /* Blur & background dihapus agar ID Card & Stamp terlihat tajam */
                        perspective: 2000px; overflow: hidden;
                        pointer-events: none;
                    }
                    .shutter-panel {
                        position: absolute; top: 0; width: 50%; height: 100%;
                        background: linear-gradient(135deg, #111, #222);
                        border: 2px solid #333; box-shadow: inset 0 0 100px rgba(0,0,0,0.8);
                        display: flex; flex-direction: column; justify-content: center; align-items: center;
                        transition: transform 1s cubic-bezier(0.85, 0, 0.15, 1);
                        z-index: 10;
                    }
                    .shutter-left { left: 0; border-right: 4px solid #DAA520; transform: translateX(0); }
                    .shutter-right { right: 0; border-left: 4px solid #DAA520; transform: translateX(0); }
                    
                    /* Digital Lock Seal */
                    .digital-lock-seal {
                        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0);
                        width: 350px; height: 350px; z-index: 50;
                        display: flex; justify-content: center; align-items: center;
                        transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    }
                    .shutter-startup .digital-lock-seal { transform: translate(-50%, -50%) scale(1); }
                    
                    .seal-ring {
                        position: absolute; border: 2px solid ${finalStatusColor};
                        border-radius: 50%; opacity: 0.5;
                        animation: seal-spin 10s linear infinite;
                    }
                    .seal-ring-outer { width: 100%; height: 100%; border-style: dashed; }
                    .seal-ring-inner { width: 80%; height: 80%; border-width: 1px; animation-direction: reverse; }
                    
                    .seal-core {
                        width: 150px; height: 150px; background: rgba(0,0,0,0.8);
                        border: 3px solid ${finalStatusColor}; border-radius: 50%;
                        display: flex; flex-direction: column; justify-content: center; align-items: center;
                        box-shadow: 0 0 30px ${finalStatusColor}, inset 0 0 20px ${finalStatusColor};
                        z-index: 2; color: #FFF; font-family: 'Rajdhani', sans-serif;
                    }
                    .seal-core .status { font-size: 14px; font-weight: bold; letter-spacing: 2px; }
                    .seal-core .id { font-size: 24px; font-weight: 900; }
                    
                    @keyframes seal-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    
                    /* Shutter Open States */
                    .shutter-crack .shutter-left { transform: translateX(-20px); }
                    .shutter-crack .shutter-right { transform: translateX(20px); }
                    .shutter-open .shutter-left { transform: translateX(-100%); }
                    .shutter-open .shutter-right { transform: translateX(100%); }
                    .shutter-open .digital-lock-seal { opacity: 0; transform: translate(-50%, -50%) scale(2); }

                    .render-line {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 4px;
                        background: linear-gradient(to right, transparent, ${finalStatusColor}, #FFF, ${finalStatusColor}, transparent);
                        box-shadow: 0 0 25px ${finalStatusColor}, 0 0 50px ${finalStatusColor};
                        z-index: 100;
                        opacity: 0;
                        pointer-events: none;
                        animation: scan-rendering 4s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.5s;
                    }
                    .render-line::before {
                        content: '[ SYSTEM_ANALYZING_BIOMETRIC_IDENTITY_DATA_STREAM ]';
                        position: absolute;
                        left: 50%;
                        transform: translateX(-50%);
                        top: -45px;
                        font-family: 'Rajdhani', 'Share Tech Mono', monospace;
                        font-size: 28px;
                        font-weight: 900;
                        color: #FFF;
                        text-shadow: 0 0 15px ${finalStatusColor}, 0 0 30px ${finalStatusColor}, 2px 2px 0px rgba(255,0,0,0.5);
                        letter-spacing: 6px;
                        animation: blink 0.15s infinite;
                        white-space: nowrap;
                    }
                    /* Efek Percikan Cahaya pada Garis */
                    .render-line::after {
                        content: '';
                        position: absolute;
                        inset: 0;
                        background: linear-gradient(90deg, transparent, #FFF, transparent);
                        filter: blur(2px);
                        animation: line-shine 0.5s infinite;
                    }
                    .stamp-scanline {
                        position: absolute;
                        top: 0; left: 0; width: 100%; height: 100px;
                        background: linear-gradient(to bottom, transparent, ${finalStatusColor}22 50%, transparent);
                        z-index: 5;
                        pointer-events: none;
                        animation: scanline-refresh 4s linear infinite;
                    }
                    @keyframes scan-rendering {
                        0% { top: 0%; opacity: 0; }
                        15% { opacity: 1; }
                        85% { opacity: 1; }
                        100% { top: 100%; opacity: 0; }
                    }
                    @keyframes line-shine {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(100%); }
                    }
                    @keyframes cardShadowEntry {
                        0% { opacity: 0; transform: scale(0.8); filter: blur(20px); }
                        100% { opacity: 0.5; transform: scale(1); filter: blur(10px); }
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

                    /* --- GOD-LEVEL DNA PULSE CURVE STYLES (Inside Stamp) --- */
                    .dna-helix-container { perspective: 1000px; overflow: hidden; }
                    .dna-base {
                        position: absolute; width: 100%; height: 2px; 
                        transform-style: preserve-3d;
                        animation: dna-hyper-pulse 3.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    }
                    .dna-base .dot { 
                        position: absolute; width: 5px; height: 5px; border-radius: 50%; top: -1.5px; 
                        filter: drop-shadow(0 0 8px currentColor);
                    }
                    .dna-base .dot.left { left: 0; }
                    .dna-base .dot.right { right: 0; }
                    .dna-base .line { 
                        position: absolute; left: 5px; right: 5px; height: 1px; top: 0.5px; 
                        opacity: 0.3;
                    }
                    @keyframes dna-hyper-pulse {
                        0%, 100% { 
                            transform: rotateY(0deg) scaleX(1) translateX(0); 
                            filter: hue-rotate(0deg) brightness(1);
                            opacity: 0.2;
                        }
                        25% {
                            transform: rotateY(90deg) scaleX(1.4) translateX(15px);
                            filter: hue-rotate(90deg) brightness(1.4);
                            opacity: 0.7;
                        }
                        48% { transform: rotateY(175deg) scaleX(1) translateX(0); filter: hue-rotate(180deg); opacity: 0.4; }
                        /* [GLITCH IMPACT] */
                        50% { 
                            transform: rotateY(180deg) scaleX(3) translateX(-30px) skewX(25deg); 
                            filter: hue-rotate(220deg) brightness(4) contrast(2) saturate(2);
                            opacity: 1;
                        }
                        52% { transform: rotateY(185deg) scaleX(1) translateX(0); filter: hue-rotate(180deg); opacity: 0.4; }
                        75% {
                            transform: rotateY(270deg) scaleX(1.2) translateX(-15px);
                            filter: hue-rotate(270deg) brightness(1.2);
                            opacity: 0.6;
                        }
                    }

                    /* --- HIGH-TECH STAMP & CARD STYLES --- */
                    /* --- HIGH-TECH STAMP & CARD STYLES --- */
                    .glass-card {
                        position: relative;
                        width: 440px;
                        padding: 35px;
                        /* Premium Glassmorphism Obsidian Aurora + Micro-Grid */
                        background: 
                            linear-gradient(135deg, rgba(2, 6, 23, 0.4) 0%, rgba(15, 23, 42, 0.7) 100%),
                            linear-gradient(rgba(20, 184, 166, 0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(20, 184, 166, 0.03) 1px, transparent 1px);
                        background-size: 100% 100%, 20px 20px, 20px 20px;
                        backdrop-filter: blur(30px);
                        -webkit-backdrop-filter: blur(30px);
                        border: 1px solid rgba(20, 184, 166, 0.15);
                        border-top: 1px solid rgba(167, 139, 250, 0.4);
                        border-left: 1px solid rgba(20, 184, 166, 0.3);
                        box-shadow: 0 40px 80px rgba(0,0,0,0.9), inset 0 0 60px rgba(255,215,0,0.05);
                        border-radius: 24px;
                        font-family: 'Inter', sans-serif;
                        color: #FFF;
                        overflow: hidden;
                        transform: translateY(-600px) scale(2);
                        opacity: 0;
                        animation: stampGlassDescend 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards 1.2s;
                        /* 3D context for inner elements */
                        transform-style: preserve-3d;
                    }
                    /* SVG Noise Overlay */
                    .glass-card::after {
                        content: '';
                        position: absolute; inset: 0;
                        background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)"/></svg>');
                        opacity: 0.15;
                        mix-blend-mode: overlay;
                        pointer-events: none;
                        z-index: 1;
                    }
                    /* Iridescent Glow Edge */
                    .glass-card::before {
                        content: '';
                        position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
                        background: conic-gradient(from 0deg, transparent 70%, rgba(255,215,0,0.4) 80%, rgba(184,134,11,0.4) 90%, transparent 100%);
                        animation: spin-cw 6s linear infinite;
                        z-index: 0; pointer-events: none;
                    }
                    @keyframes stampGlassDescend {
                        0% { transform: translateY(-600px) scale(2); opacity: 0; }
                        50% { transform: translateY(20px) scale(0.95); opacity: 0.8; }
                        75% { transform: translateY(-10px) scale(1.02); opacity: 1; }
                        100% { transform: translateY(0) scale(1); opacity: 1; box-shadow: 0 40px 80px rgba(0,0,0,0.9), 0 0 50px rgba(255,215,0,0.2); }
                    }
                    /* Scanner Line */
                    .scanner-laser {
                        position: absolute;
                        left: 0; top: -10px; width: 100%; height: 2px;
                        background: linear-gradient(90deg, transparent, ${finalStatusColor}, transparent);
                        box-shadow: 0 0 15px ${finalStatusColor}, 0 0 30px ${finalStatusColor};
                        z-index: 10;
                        opacity: 0;
                        animation: scanSweep 3s ease-in-out infinite 2s;
                    }
                    @keyframes scanSweep {
                        0% { top: -10px; opacity: 0; }
                        10% { opacity: 1; }
                        90% { opacity: 1; }
                        100% { top: 100%; opacity: 0; }
                    }
                    /* Dynamic Holographic Glare */
                    .glass-glare {
                        position: absolute; inset: 0;
                        background: linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.15) 25%, transparent 30%);
                        background-size: 200% 200%;
                        animation: glareSweep 4s infinite linear;
                        pointer-events: none; z-index: 5; mix-blend-mode: overlay;
                    }
                    @keyframes glareSweep {
                        0% { background-position: -100% -100%; }
                        100% { background-position: 200% 200%; }
                    }
                    @keyframes streamScroll {
                        0% { transform: translateY(-50%); }
                        100% { transform: translateY(0%); }
                    }
                    /* Staggered Reveal with Snap to Focus */
                    .reveal-item {
                        opacity: 0;
                        transform: translateY(20px) translateZ(10px);
                        filter: blur(12px);
                        animation: itemReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                    @keyframes itemReveal {
                        100% { opacity: 1; transform: translateY(0) translateZ(30px); filter: blur(0px); }
                    }
                    @keyframes pulseGlow {
                        0%, 100% { box-shadow: 0 0 5px ${finalStatusColor}20; }
                        50% { box-shadow: 0 0 20px ${finalStatusColor}60; }
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
                        border: 4px double ${finalStatusColor}80;
                        padding: 15px;
                        text-align: center;
                    }
                    .stamp-header {
                        display: flex; align-items: center; justify-content: center;
                        gap: 15px; padding-bottom: 10px;
                        border-bottom: 1px solid ${finalStatusColor}40;
                    }
                    .emblem {
                        width: 60px; height: 60px; border-radius: 50%;
                        border: 2px solid ${finalStatusColor}; padding: 4px; background: #000;
                        position: relative;
                    }
                    .emblem::before {
                        content: ''; position: absolute; inset: -8px; 
                        border: 2px dashed ${finalStatusColor}; border-radius: 50%;
                        animation: spin-slow 4s linear infinite; opacity: 0.4;
                    }
                    .emblem img { width: 100%; height: 100%; object-fit: contain; border-radius: 50%; }
                    .emblem-text { text-align: left; }
                    .emblem-text span { display: block; text-transform: uppercase; font-weight: 900; background: linear-gradient(to bottom, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.9)); border-bottom: 4px double ${finalStatusColor}; padding-bottom: 2px; }
                    .emblem-text span { font-size: 24px; letter-spacing: 1px; background: linear-gradient(to bottom, #E0E0E0, #A0A0A0, #C0C0C0, #808080, #E0E0E0); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; text-fill-color: transparent; filter: drop-shadow(0 0 2px rgba(255,255,255,0.3)); }
                    .stamp-status {
                        font-size: 3rem; font-weight: 900; letter-spacing: 2px;
                        text-transform: uppercase; color: ${finalStatusColor};
                        background: linear-gradient(to bottom, #F0F0F0, #B0B0B0, #D0D0D0, #909090, #F0F0F0); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; text-fill-color: transparent; text-shadow: 0 0 15px rgba(255,255,255,0.5), 0 0 30px rgba(255,255,255,0.3); margin: 15px 0; line-height: 1;
                    }
                    .stamp-details {
                        font-size: 12px; color: #C0C0C0; /* Chrome-like gray */
                        border-top: 1px solid ${finalStatusColor}40;
                        border-bottom: 1px solid ${finalStatusColor}40;
                        padding: 10px 0; margin-bottom: 15px;
                    }
                    .stamp-details > div { display: flex; justify-content: space-between; padding: 6px 10px; border-bottom: 1px dashed rgba(255,255,255,0.1); }
                    .stamp-details > div:last-child { border-bottom: none; }
                    .stamp-details > div span:first-child { font-weight: 800; color: #DAA520; text-shadow: 1px 1px 2px #000; letter-spacing: 1px; }
                    .stamp-details > div span:last-child { font-weight: 800; color: #FFF; text-shadow: 1px 1px 2px #000; letter-spacing: 1px; }
                    .stamp-footer {
                        font-family: 'Courier New', monospace; font-size: 10px; color: #C0C0C0; /* Chrome-like gray */
                        background: rgba(0,0,0,0.3); padding: 8px; border: 1px solid #606060; /* Darker border for contrast */
                        word-break: break-all;
                        position: relative; overflow: hidden;
                    }
                    
                    /* --- ID CARD STYLES --- */
                    .id-card-container {
                        width: 420px;
                        position: relative;
                        perspective: 1500px;
                    }
                    .id-card-content {
                        background: #0a0a0a;
                        border-radius: 12px;
                        transform-style: preserve-3d;
                        font-family: 'Arial', sans-serif;
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
                    /* [IDE BARU] Animasi DNA Helix */
                    @keyframes dna-spin {
                        from { transform: rotateY(0deg); }
                        to { transform: rotateY(360deg); }
                    }
                    .dna-helix-container {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        width: 100px;
                        height: 100%;
                        transform: translate(-50%, -50%);
                        perspective: 600px;
                        z-index: 0;
                        opacity: 0.15;
                    }
                    .dna-base {
                        position: absolute;
                        width: 100%;
                        height: 2px;
                        left: 0;
                        transform-style: preserve-3d;
                        animation: dna-spin 4s linear infinite;
                    }
                    .dna-base .dot { position: absolute; width: 6px; height: 6px; border-radius: 50%; top: -2px; }
                    .dna-base .dot.left { left: 0; }
                    .dna-base .dot.right { right: 0; }
                    .dna-base .line { position: absolute; left: 3px; right: 3px; height: 1px; top: 0; opacity: 0.5; }


                    @keyframes watermark-glitch {
                        0%, 100% { opacity: 0.06; transform: rotate(-45deg) translate(0,0); }
                        49% { opacity: 0.06; transform: rotate(-45deg) translate(0,0); }
                        50% { opacity: 0.02; transform: rotate(-45deg) translate(2px, -2px); }
                        51% { opacity: 0.06; transform: rotate(-45deg) translate(0,0); }
                    }
                    @keyframes hologram-flicker {
                        0%, 19.9%, 22%, 62.9%, 64%, 64.9%, 70%, 100% { opacity: 1; filter: brightness(1); }
                        20%, 21.9% { opacity: 0.5; filter: brightness(2) contrast(1.5); }
                        63%, 63.9% { opacity: 0.8; transform: scale(1.01); }
                        65%, 69.9% { opacity: 0.4; filter: brightness(0.6) blur(1px); }
                    }
                    @keyframes hologram-glitch {
                        0%, 95%, 100% { transform: translate(0,0); filter: none; }
                        96% { transform: translate(-10px, 5px) skewX(15deg); filter: hue-rotate(120deg) saturate(3); opacity: 0.8; }
                        97% { transform: translate(10px, -5px) skewX(-15deg); filter: hue-rotate(-120deg) contrast(3); opacity: 0.8; }
                        98% { transform: translate(0, 10px) scaleY(0.05); }
                        99% { transform: translate(0,0); filter: invert(1) brightness(2); }
                    }
                    @keyframes holo-bar {
                        0% { opacity: 0.3; transform: translate(-50%, -50%) scale(0.8); }
                        100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.2); }
                    }
                    
                    /* --- ENHANCED REALISTIC HOLOGRAM STAMP EFFECTS --- */
                    .hologram-scanline-v {
                        position: absolute; inset: 0;
                        background: linear-gradient(to bottom, transparent, ${finalStatusColor}44 50%, transparent);
                        background-size: 100% 12px;
                        animation: h-scan 4s linear infinite;
                        z-index: 10; pointer-events: none;
                        mix-blend-mode: overlay;
                    }
                    @keyframes h-scan { from { transform: translateY(-100%); } to { transform: translateY(100%); } }
                    
                    .hologram-noise-overlay {
                        position: absolute; inset: 0;
                        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
                        opacity: 0.15; mix-blend-mode: screen; z-index: 11; pointer-events: none;
                        animation: noise-jitter 0.15s steps(2) infinite;
                    }
                    @keyframes noise-jitter { from { transform: translate(0,0); } to { transform: translate(-1%, -1%); } }

                    .prismatic-layer {
                        position: absolute; inset: 0;
                        background: linear-gradient(135deg, rgba(255,0,0,0.15), rgba(0,255,0,0.15), rgba(0,0,255,0.15), rgba(255,255,0,0.15), rgba(255,0,255,0.15), rgba(0,255,255,0.15));
                        background-size: 400% 400%;
                        animation: prism-flow 8s ease infinite;
                        mix-blend-mode: overlay; z-index: 4; opacity: 0.6;
                        filter: blur(20px) contrast(1.8);
                    }
                    @keyframes prism-flow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

                    /* Realistic Chromatic Aberration for Text */
                    .stamp-status {
                        animation: chromatic-flicker 4s infinite;
                    }
                    @keyframes chromatic-flicker {
                        0%, 90%, 100% { text-shadow: 0 0 10px ${finalStatusColor}, 0 0 20px ${finalStatusColor}66; }
                        92% { text-shadow: -3px 0 0 #ff00ff, 3px 0 0 #00ffff, 0 0 15px ${finalStatusColor}; }
                        94% { text-shadow: 3px 0 0 #ff00ff, -3px 0 0 #00ffff, 0 0 10px ${finalStatusColor}; }
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
                        width: 560px;
                        padding: 60px;
                        /* [ULTRA-PREMIUM STEALTH] JET BLACK CARBON & DIAMOND GLOSS */
                        background: 
                            linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(0,0,0,0.4) 100%),
                            url('carbon_fiber.png'),
                            #000;
                        background-size: 100% 100%, 200px 200px, 100% 100%;
                        background-blend-mode: screen, overlay, normal;

                        /* Sharp Glowing White Hairlines */
                        box-shadow: 
                            0 80px 150px rgba(0,0,0,1),
                            inset 0 0 0 1px rgba(255,255,255,0.9), /* Crisp White Border */
                            inset 0 0 20px rgba(255,255,255,0.1), /* Soft Glow */
                            0 0 0 8px #000,                      /* Black Gap */
                            0 0 0 9px rgba(255,255,255,0.8);      /* Outer White Border */
                        
                        border: none;
                        border-radius: 2px;
                        font-family: 'Playfair Display', serif;
                        color: #FFF;
                        overflow: hidden;
                        transform: translateY(100px);
                        opacity: 0;
                        animation: stampPowerEntry 1.2s cubic-bezier(0.19, 1, 0.22, 1) forwards 1s;
                    }
                    @keyframes stampPowerEntry {
                        0% { opacity: 0; transform: translateY(80px) scale(0.95); }
                        100% { opacity: 1; transform: translateY(0) scale(1); }
                    }

                    /* Diamond Glint (Moving Light Beam) */
                    .academic-stamp::before {
                        content: '';
                        position: absolute;
                        top: -150%; left: -150%;
                        width: 400%; height: 400%;
                        background: linear-gradient(
                            45deg,
                            transparent 45%,
                            rgba(255, 255, 255, 0) 47%,
                            rgba(255, 255, 255, 0.6) 50%,
                            rgba(255, 255, 255, 0) 53%,
                            transparent 55%
                        );
                        transform: rotate(-20deg);
                        animation: diamond-glint 5s infinite ease-in-out;
                        pointer-events: none;
                        z-index: 5;
                    }
                    @keyframes diamond-glint {
                        0% { transform: translate(-30%, -30%) rotate(-20deg); }
                        30%, 100% { transform: translate(30%, 30%) rotate(-20deg); }
                    }
               pointer-events: none;
                    }
                    @keyframes silk-shine { 
                        0% { background-position: -100% 0; }
                        100% { background-position: 200% 0; }
                    }

                    /* God-Level Light Sweep (Anamorphic Flare) */
                    .academic-stamp::after {
                        content: '';
                        position: absolute;
                        top: -100%; left: -100%;
                        width: 300%; height: 300%;
                        background: linear-gradient(
                            45deg,
                            transparent 45%,
                            rgba(255, 255, 255, 0.1) 48%,
                            rgba(255, 255, 255, 0.4) 50%,
                            rgba(255, 255, 255, 0.1) 52%,
                            transparent 55%
                        );
                        transform: rotate(-25deg);
                        animation: sweep 6s infinite;
                        pointer-events: none;
                        z-index: 6;
                    }
                    @keyframes sweep {
                        0% { transform: translate(-50%, -50%) rotate(-25deg); }
                        20%, 100% { transform: translate(50%, 50%) rotate(-25deg); }
                    }

                    .academic-stamp:hover::before {
                        opacity: 1;
                    }

                    /* Holographic Security Seal */
                    .security-seal {
                        position: absolute;
                        top: 25px; right: 25px;
                        width: 60px; height: 60px;
                        background: conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
                        border-radius: 50%;
                        opacity: 0.5;
                        mix-blend-mode: color-dodge;
                        animation: rotate-seal 10s linear infinite;
                        z-index: 10;
                        border: 1px solid rgba(255,255,255,0.3);
                        box-shadow: 0 0 15px rgba(255,255,255,0.2);
                    }
                    @keyframes rotate-seal { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    
                    .micro-text-border {
                        position: absolute;
                        inset: 5px;
                        border: 1px solid rgba(255,255,255,0.05);
                        pointer-events: none;
                        z-index: 10;
                    }
                    .micro-text-border::before {
                        content: 'VERIFIED_SECURE_AETHER_BIOMETRIC_ENCRYPTION_PROTOCOL_v4.5_AUTHORIZED_ONLY_';
                        position: absolute; top: 2px; left: 0; width: 100%;
                        font-size: 5px; color: rgba(255,255,255,0.2);
                        letter-spacing: 2px; white-space: nowrap; overflow: hidden;
                    }
                    .guilloche-bg {
                        position: absolute; inset: 0; opacity: 0.3;
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
                        border: 2px solid ${finalStatusColor};
                        outline: 10px solid rgba(255,255,255,0.02);
                        padding: 20px;
                        text-align: center;
                        background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 80%);
                    }
                    .stamp-content::after {
                        content: '';
                        position: absolute; inset: 5px;
                        border: 1px solid ${finalStatusColor}44;
                        pointer-events: none;
                    }
                    .stamp-header {
                        display: flex; align-items: center; justify-content: center;
                        gap: 15px; padding-bottom: 10px;
                        border-bottom: 1px solid ${finalStatusColor}40;
                    }
                    .emblem {
                        width: 100px; height: 100px; border-radius: 0;
                        border: 2px solid #e0f2fe; padding: 10px; background: #FFF;
                        box-shadow: 0 15px 30px rgba(0,0,0,0.8);
                    }
                    .emblem img { width: 100%; height: 100%; object-fit: contain; }
                    .emblem-text { text-align: left; }
                    .emblem-text span {
                        display: block; text-transform: uppercase; font-weight: 800;
                        font-family: 'Playfair Display', serif;
                        /* Combination: Gold + White Shine */
                        background: linear-gradient(to bottom, #FFF 0%, #e0f2fe 50%, #B8860B 100%);
                        -webkit-background-clip: text; background-clip: text; color: transparent; 
                        border-bottom: 2px solid #e0f2fe; padding-bottom: 10px;
                        font-size: 38px; letter-spacing: 6px; line-height: 1;
                    }
                    .stamp-status {
                        /* [ULTRA-SHARP CONTRAST] Higher brightness & Sharp shadows */
                        font-size: 3.2rem; font-weight: 900; letter-spacing: 6px;
                        text-transform: uppercase;
                        font-family: 'Playfair Display', serif;
                        /* Pure Platinum & High-Glow Gold */
                        background: linear-gradient(to bottom, #FFF 0%, #FFF 40%, #e0f2fe 100%);
                        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                        
                        /* Sharp 'Stroke' Effect for Maximum Visibility */
                        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.9));
                        text-shadow: 0 0 1px rgba(0,0,0,1); 
                        
                        margin: 25px 0; line-height: 1;
                        position: relative;
                        max-width: 100%; word-wrap: break-word;
                        z-index: 10;
                    }
                    .stamp-status::after {
                        content: '';
                        position: absolute; bottom: -20px; left: 25%; right: 25%;
                        height: 3px; background: linear-gradient(90deg, transparent, #e0f2fe, #FFF, #e0f2fe, transparent);
                        box-shadow: 0 0 15px #e0f2fe;
                    }
                    @keyframes status-pulse {
                        0%, 100% { filter: drop-shadow(0 0 15px rgba(255,255,255,0.4)); transform: perspective(1000px) rotateX(15deg) translateZ(50px) scale(1); }
                        50% { filter: drop-shadow(0 0 25px ${finalStatusColor}88); transform: perspective(1000px) rotateX(15deg) translateZ(70px) scale(1.02); }
                    }
                    .stamp-details {
                        font-size: 16px; color: #FFF;
                        border-top: 1px solid rgba(221, 188, 130, 0.4);
                        border-bottom: 1px solid rgba(221, 188, 130, 0.4);
                        padding: 15px 0; margin-bottom: 20px;
                        font-family: 'Montserrat', sans-serif;
                        text-transform: uppercase;
                        background: rgba(0,0,0,0.7); /* Text Shield */
                        border-radius: 4px;
                        box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
                        backdrop-filter: blur(5px);
                        -webkit-backdrop-filter: blur(5px);
                    }
                    .stamp-details > div { display: flex; justify-content: space-between; padding: 6px 15px; border-bottom: 1px dashed rgba(255,255,255,0.1); }
                    .stamp-details > div:last-child { border-bottom: none; }
                    .stamp-details > div span:first-child { font-weight: 900; color: #DAA520; text-shadow: 1px 1px 2px #000, 0 0 8px rgba(0,255,255,0.5); letter-spacing: 1px; } /* Cyan Glow */
                    .stamp-details > div span:last-child { font-weight: 800; color: #FFF; text-shadow: 1px 1px 3px #000, 0 0 10px rgba(255,255,255,0.4); letter-spacing: 1px; }
                    
                    .stamp-footer {
                        font-family: 'Arial', sans-serif; font-size: 9px; color: rgba(255,255,255,0.4);
                        text-align: center;
                        padding-top: 10px;
                        letter-spacing: 2px;
                    }
                    
                    /* --- ID CARD STYLES --- */
                    .id-card-container {
                        width: 420px;
                        position: relative;
                        perspective: 1500px;
                    }
                    .id-card-content {
                        background: #0a0a0a;
                        border-radius: 12px;
                        transform-style: preserve-3d;
                        font-family: 'Arial', sans-serif;
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

                    /* --- [GOD TIER] 3D HYPER-TECH SHUTTER STYLES --- */
                    .shutter-layer {
                        position: absolute; inset: 0; z-index: 9999;
                        display: flex; pointer-events: none;
                        perspective: 1500px; overflow: hidden;
                    }
                    .shutter-panel {
                        flex: 1; 
                        background: 
                            /* LUXURY 3D MOTIF: Gold Dust + Hex Mesh + Deep Metal */
                            radial-gradient(circle, rgba(255, 215, 0, 0.05) 1px, transparent 1px),
                            repeating-linear-gradient(60deg, rgba(20, 20, 20, 0.5) 0, rgba(20, 20, 20, 0.5) 1px, transparent 1px, transparent 15px),
                            repeating-linear-gradient(-60deg, rgba(20, 20, 20, 0.5) 0, rgba(20, 20, 20, 0.5) 1px, transparent 1px, transparent 15px),
                            linear-gradient(to bottom, #1a1a1a 0%, #000 40%, #000 60%, #1a1a1a 100%);
                        background-size: 20px 20px, 30px 52px, 30px 52px, 100% 100%;
                        position: relative;
                        transition: transform 0.8s cubic-bezier(0.6, -0.28, 0.735, 0.045); /* Slower, heavier feel */
                        border-top: 3px solid ${finalStatusColor};
                        border-bottom: 3px solid ${finalStatusColor};
                        display: flex; flex-direction: column; justify-content: center;
                        box-shadow: inset 0 0 150px #000;
                        overflow: hidden;
                        will-change: transform;
                    }
                    .shutter-left { 
                        transform-origin: left center; 
                        border-right: 4px solid ${finalStatusColor};
                        box-shadow: inset -20px 0 50px rgba(0,0,0,0.9), 10px 0 30px rgba(0,0,0,0.8);
                        z-index: 2;
                    }
                    .shutter-right { 
                        transform-origin: right center; 
                        border-left: 4px solid ${finalStatusColor};
                        box-shadow: inset 20px 0 50px rgba(0,0,0,0.9), -10px 0 30px rgba(0,0,0,0.8);
                        z-index: 2;
                    }
                    
                    /* HYPER-MECHANICAL BOLTS (Kunci Pintu) */
                    .mech-bolt {
                        position: absolute; width: 160px; height: 70px; /* Lebih Besar & Mewah */
                        /* [UPDATE] Silver/Chrome 3D Gradient */
                        background: linear-gradient(to bottom, #666, #ccc 30%, #fff 50%, #ccc 70%, #666);
                        border: 1px solid #555;
                        box-shadow: 
                            0 10px 30px rgba(0,0,0,0.9), 
                            inset 0 1px 0 rgba(255,255,255,0.6);
                        z-index: 20;
                        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Springy retract */
                        display: flex; align-items: center; justify-content: center;
                    }
                    .mech-bolt::after {
                        content: ''; width: 80%; height: 2px; background: #555;
                        box-shadow: 0 1px 0 rgba(255,255,255,0.4);
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
                        font-family: 'Rajdhani', sans-serif; font-size: 90px; /* Lebih Besar */
                        font-weight: 900;
                        text-align: center; pointer-events: none; user-select: none;
                        white-space: nowrap; overflow: visible;
                        letter-spacing: 0.1em;
                        /* Realistic 3D Gold Emboss Effect with Shine Sweep */
                        background: 
                            linear-gradient(120deg, transparent 0%, transparent 35%, rgba(255, 255, 255, 1) 50%, transparent 65%, transparent 100%),
                            linear-gradient(180deg, #B8860B 0%, #FFD700 30%, #FFFFF0 50%, #FFD700 70%, #B8860B 100%); /* Richer Gold */
                        background-size: 200% 100%, 100% 100%;
                        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                        animation: text-shine 2s ease-in-out infinite;
                        /* Efek 3D Tebal & Menonjol */
                        filter: 
                            drop-shadow(0 2px 0 #3e2b0e)
                            drop-shadow(0 4px 0 #3e2b0e)
                            drop-shadow(0 6px 0 #3e2b0e)
                            drop-shadow(0 10px 20px rgba(0,0,0,0.8));
                        opacity: 1;
                        z-index: 20;
                    }

                    /* GOD-TIER LOCK MECHANISM (Mekanisme Kunci Tingkat Dewa) */
                    .lock-half {
                        position: absolute; top: 50%; width: 200px; height: 380px; /* Sedikit lebih besar */
                        transform: translateY(-50%); z-index: 15;
                        pointer-events: none;
                        display: flex; align-items: center;
                        filter: drop-shadow(0 0 40px rgba(0,0,0,1)); /* Shadow lebih pekat */
                    }

                    .shutter-left .lock-half { right: -100px; justify-content: flex-end; }
                    .shutter-right .lock-half { left: -100px; justify-content: flex-start; }

                    .lock-casing {
                        width: 100%; height: 100%;
                        background: 
                            /* Interlocking Mechanism Texture */
                            repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.02) 5px, rgba(255,255,255,0.02) 10px),
                            linear-gradient(180deg, #0a0a0a 0%, #252525 50%, #0a0a0a 100%);
                        position: relative;
                        overflow: hidden;
                        border: 2px solid #555;
                        box-shadow: inset 0 0 60px #000, 0 0 40px rgba(0,0,0,0.9);
                    }

                    .shutter-left .lock-casing {
                        border-radius: 30px 0 0 30px;
                        /* Interlocking Shape (Female/Socket) */
                        clip-path: polygon(0 10%, 20% 0, 100% 0, 100% 35%, 80% 50%, 100% 65%, 100% 100%, 20% 100%, 0 90%);
                    }
                    .shutter-right .lock-casing {
                        border-radius: 0 30px 30px 0;
                        /* Interlocking Shape (Male/Tooth) */
                        clip-path: polygon(0 0, 80% 0, 100% 10%, 100% 90%, 80% 100%, 0 100%, 0 65%, 20% 50%, 0 35%);
                    }

                    /* Rotating Reactor Rings */
                    .mag-ring {
                        position: absolute; top: 50%; width: 280px; height: 280px;
                        border-radius: 50%;
                        transform: translateY(-50%);
                        border: 2px solid transparent;
                    }
                    .mag-ring::before {
                        content: ''; position: absolute; inset: 0; border-radius: 50%;
                        border: 10px dashed ${finalStatusColor}33;
                        mask-image: linear-gradient(to bottom, transparent, black);
                    }

                    .shutter-left .mag-ring { right: -140px; animation: spin-cw 10s linear infinite; }
                    .shutter-right .mag-ring { left: -140px; animation: spin-ccw 10s linear infinite; }

                    .plasma-core {
                        position: absolute; top: 50%; width: 140px; height: 140px;
                        border-radius: 50%;
                        background: radial-gradient(circle, ${finalStatusColor} 0%, transparent 70%);
                        opacity: 0.3;
                        transform: translateY(-50%);
                        filter: blur(10px);
                        animation: pulse-core 2s ease-in-out infinite;
                    }
                    .shutter-left .plasma-core { right: -70px; }
                    .shutter-right .plasma-core { left: -70px; }

                    /* Locking Pins */
                    .lock-pin {
                        position: absolute; width: 60px; height: 20px; /* Lebih besar */
                        background: linear-gradient(to bottom, #fff, #ccc, #fff); /* Metallic */
                        box-shadow: 0 0 5px #000;
                        top: 50%; transform: translateY(-50%);
                        z-index: 20;
                        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                    }
                    .shutter-left .lock-pin { right: -5px; border-radius: 4px 0 0 4px; }
                    .shutter-right .lock-pin { left: -5px; border-radius: 0 4px 4px 0; }

                    /* INDICATOR LIGHT (Lampu Status) */
                    .lock-indicator {
                        position: absolute; top: 50%; width: 16px; height: 16px;
                        background: #ff0000; /* Locked: RED */
                        border-radius: 50%;
                        box-shadow: 0 0 10px #ff0000, inset 0 0 5px #000;
                        z-index: 25;
                        transform: translateY(-50%);
                        border: 1px solid #333;
                        transition: all 0.2s ease;
                    }
                    .shutter-left .lock-indicator { right: 35px; }
                    .shutter-right .lock-indicator { left: 35px; }

                    /* Tech Details */
                    .vent-slots {
                        position: absolute; width: 60%; height: 60px;
                        background: repeating-linear-gradient(90deg, #000, #000 5px, #333 5px, #333 6px);
                        opacity: 0.5;
                    }
                    .shutter-left .vent-slots { left: 10px; top: 20px; transform: skewX(-20deg); }
                    .shutter-right .vent-slots { right: 10px; bottom: 20px; transform: skewX(-20deg); }

                    /* Animations */
                    @keyframes spin-cw { from { transform: translateY(-50%) rotate(0deg); } to { transform: translateY(-50%) rotate(360deg); } }
                    @keyframes spin-ccw { from { transform: translateY(-50%) rotate(360deg); } to { transform: translateY(-50%) rotate(0deg); } }
                    @keyframes pulse-core { 0%, 100% { opacity: 0.3; transform: translateY(-50%) scale(1); } 50% { opacity: 0.6; transform: translateY(-50%) scale(1.2); } }

                    /* GEAR ANIMATIONS */
                    @keyframes gear-spin-cw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    @keyframes gear-spin-ccw { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }

                    /* GEAR MECHANISM */
                    .gear-mechanism { position: absolute; inset: 0; z-index: 1; opacity: 0.6; pointer-events: none; }
                    .gear {
                        position: absolute; border-radius: 50%;
                        background: conic-gradient(from 0deg, #111 0%, #444 10%, #111 20%, #444 30%, #111 40%, #444 50%, #111 60%, #444 70%, #111 80%, #444 90%, #111 100%);
                        box-shadow: inset 0 0 10px #000, 0 5px 10px rgba(0,0,0,0.8);
                        display: flex; align-items: center; justify-content: center;
                        border: 1px solid #333;
                    }
                    .gear::after {
                        content: ''; position: absolute; inset: -4px; border-radius: 50%;
                        border: 4px dashed #555; box-sizing: border-box;
                        mask-image: radial-gradient(transparent 65%, black 70%); -webkit-mask-image: radial-gradient(transparent 65%, black 70%);
                    }
                    .gear::before { content: ''; position: absolute; width: 30%; height: 30%; background: radial-gradient(circle, #000 0%, #333 100%); border-radius: 50%; border: 1px solid #555; }
                    .g-1 { width: 120px; height: 120px; top: -30px; right: -30px; animation: gear-spin-ccw 10s linear infinite; }
                    .g-2 { 
                        width: 45px; height: 45px; top: 70px; right: 35px; animation: gear-spin-cw 6s linear infinite;
                        /* 3D Realistic Style */
                        background: radial-gradient(circle at 30% 30%, #888, #222);
                        box-shadow: inset 2px 2px 5px rgba(255,255,255,0.4), inset -2px -2px 5px rgba(0,0,0,0.9), 0 5px 15px rgba(0,0,0,0.8);
                        border: none;
                    }
                    .g-2::after { border: 5px dashed #666; filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.9)); inset: -5px; }
                    .g-2::before { background: radial-gradient(circle at 70% 70%, #222, #000); box-shadow: inset 1px 1px 3px rgba(0,0,0,1); border: 1px solid #555; width: 35%; height: 35%; }
                    .g-3 { width: 50px; height: 50px; bottom: 60px; right: 10px; animation: gear-spin-ccw 4s linear infinite; }
                    .shutter-right .gear-mechanism { transform: scaleX(-1); }
                    .shutter-crack .gear { animation-duration: 0.5s; filter: brightness(1.5); }

                    /* HOLOGRAPHIC SEAL (Segel Tengah - Updated) */
                    .holo-seal {
                        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                        width: 180px; height: 180px; border-radius: 50%;
                        border: 2px solid ${finalStatusColor};
                        box-shadow: 0 0 30px ${finalStatusColor}, inset 0 0 30px ${finalStatusColor};
                        background: rgba(0, 0, 0, 0.3);
                        z-index: 10001; pointer-events: none;
                        display: flex; align-items: center; justify-content: center;
                        transition: all 0.3s ease-out;
                        backdrop-filter: blur(5px);
                    }
                    .holo-seal::after {
                        content: 'SECURE'; font-family: 'Share Tech Mono'; color: ${finalStatusColor};
                        font-size: 24px; letter-spacing: 4px; font-weight: bold; animation: blink 0.5s infinite;
                        text-shadow: 0 0 10px ${finalStatusColor};
                    }
                    
                    /* UNLOCK STATE */
                    .shutter-crack .holo-seal {
                        transform: translate(-50%, -50%) scale(2);
                        opacity: 0; filter: blur(20px); /* Segel hologram pecah */
                    }
                    /* INDICATOR TURNS GREEN ON UNLOCK */
                    .shutter-crack .lock-indicator {
                        background: #00ff00; /* Unlocked: GREEN */
                        box-shadow: 0 0 20px #00ff00, 0 0 40px #00ff00;
                    }
                    .shutter-crack .lock-pin { width: 0; opacity: 0; }
                    .shutter-crack .mag-ring { border-color: #fff; box-shadow: 0 0 80px #fff; animation-duration: 0.5s; }
                    .shutter-crack .plasma-core { background: radial-gradient(circle, #fff 0%, ${finalStatusColor} 50%, transparent 80%); opacity: 1; filter: blur(2px); transform: translateY(-50%) scale(1.5); }
                    .shutter-crack .lock-casing {
                        box-shadow: inset 0 0 50px ${finalStatusColor};
                        border-color: #fff;
                    }

                    /* OPEN STATE - Pintu & Gembok Geser Bersama */
                    .shutter-open .shutter-panel {
                        transition: transform 2.5s cubic-bezier(0.2, 0.6, 0.3, 1);
                    }
                    /* Tidak perlu animasi khusus untuk lock-half di sini karena dia anak dari shutter-panel, 
                       jadi dia otomatis ikut bergeser keluar layar */
                    
                    /* TEASE STATE (Sedikit Terbuka - Mengintip) */
                    .shutter-crack .shutter-left { transform: translateX(-40px); }
                    .shutter-crack .shutter-right { transform: translateX(40px); }

                    /* OPEN STATE ANIMATION (Heavy Slide) */
                    .shutter-open .shutter-panel {
                        transition: transform 3.5s cubic-bezier(0.65, 0, 0.35, 1); /* Slower, heavier slide */
                        opacity: 1 !important; /* Force opacity agar tidak memudar */
                    }
                    .shutter-open .shutter-left { 
                        transform: translateX(-105%); /* Slide fully off-screen left */
                    }
                    .shutter-open .shutter-right { 
                        transform: translateX(105%); /* Slide fully off-screen right */
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
                    
                    @keyframes text-shine {
                        0% { background-position: -200% 0, 0 0; }
                        100% { background-position: 200% 0, 0 0; }
                    }
                    @keyframes frame-shine {
                        0% { transform: translateX(-100%) skewX(-20deg); }
                        50%, 100% { transform: translateX(200%) skewX(-20deg); }
                    }

                    /* ELECTRIC SPARKS (Percikan Listrik) */
                    .spark-gap {
                        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                        width: 60px; height: 100px; z-index: 10005; pointer-events: none;
                    }
                    .spark {
                        position: absolute; left: 50%; top: 50%; width: 4px; height: 4px;
                        background: #fff; border-radius: 50%;
                        box-shadow: 0 0 10px #fff, 0 0 20px #FBBF24;
                        opacity: 0;
                    }
                    .shutter-crack .spark { animation: spark-fly 0.4s ease-out forwards; }
                    
                    .shutter-crack .spark:nth-child(2) { --tx: -50px; --ty: -80px; animation-delay: 0s; }
                    .shutter-crack .spark:nth-child(3) { --tx: 60px; --ty: -60px; animation-delay: 0.05s; }
                    .shutter-crack .spark:nth-child(4) { --tx: -40px; --ty: 70px; animation-delay: 0.1s; }
                    .shutter-crack .spark:nth-child(5) { --tx: 50px; --ty: 90px; animation-delay: 0.02s; }
                    .shutter-crack .spark:nth-child(6) { --tx: -70px; --ty: -20px; animation-delay: 0.08s; }

                    @keyframes spark-fly {
                        0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                        100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0); }
                    }

                    /* Electric Arc Line (Kilatan Tengah) */
                    .arc-line {
                        position: absolute; top: 10%; bottom: 10%; left: 50%; width: 2px;
                        background: linear-gradient(to bottom, transparent, #FBBF24, #FFF, #FBBF24, transparent);
                        opacity: 0; transform: translateX(-50%);
                        filter: blur(1px);
                    }
                    .shutter-crack .arc-line {
                        animation: arc-flash 0.3s steps(5) forwards;
                    }
                    @keyframes arc-flash {
                        0% { opacity: 0; height: 0; top: 50%; }
                        50% { opacity: 1; height: 80%; top: 10%; width: 4px; }
                        100% { opacity: 0; height: 100%; width: 1px; }
                    }
                    @keyframes holo-bar {
                        0% { background-position: 150% 0; opacity: 0; }
                        20% { opacity: 1; }
                        80% { opacity: 1; }
                        100% { background-position: -50% 0; opacity: 0; }
                    }
                </style>

                <!-- [GOD TIER] 3D SHUTTER CURTAIN (Overlay on top) -->
                <div id="cyber-shutter" class="shutter-layer">
                    <!-- Digital Lock Seal (Centerpiece) -->
                    <div class="digital-lock-seal">
                        <div class="seal-ring seal-ring-outer"></div>
                        <div class="seal-ring seal-ring-inner"></div> 
                        <div class="seal-core">
                            <div class="status">${result.success ? 'AMAN' : 'DITOLAK'}</div>
                            <div class="id" style="width:80px; height:80px; margin:5px 0; border-radius:50%; border:2px solid ${finalStatusColor}; overflow:hidden; display:flex; justify-content:center; align-items:center; background:#000;">
                                ${employeeData && employeeData.foto ? `<img src="data:image/jpeg;base64,${employeeData.foto}" style="width:100%; height:100%; object-fit:cover;" alt="ID"/>` : `<span style="font-size:24px;">${karyawanId}</span>`}
                            </div>
                            <div style="font-size: 8px; opacity: 0.6; margin-top: 5px;">KUNCI BIOMETRIK</div>
                        </div>
                    </div>

                    <div class="energy-flash"></div>
                    
                    <!-- Electric Sparks Container -->
                    <div class="spark-gap">
                        <div class="arc-line"></div>
                        <div class="spark"></div>
                        <div class="spark"></div>
                    </div>
                    
                    <div class="shutter-panel shutter-left">
                        <div class="mech-bolt bolt-top"></div>
                        <div class="mech-bolt bolt-bottom"></div>
                        <div class="shutter-data" style="font-size: 100px; letter-spacing: 20px; opacity: 0.25;">PUSKESMAS</div>
                    </div>
                    
                    <div class="shutter-panel shutter-right">
                        <div class="mech-bolt bolt-top"></div>
                        <div class="mech-bolt bolt-bottom"></div>
                        <div class="shutter-data" style="font-size: 100px; letter-spacing: 20px; opacity: 0.25;">WANA</div>
                    </div>
                </div>

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
                <div style="display: flex; justify-content: center; align-items: center; gap: 40px; width: 100%; transform-style: preserve-3d;">
                    <!-- [FIXED] Kolom Kiri: ID Card (Ditampilkan kembali) -->
                    <div style="transform: translateZ(20px); position: relative;">
                        <!-- Card Drop Shadow -->
                        <div style="position: absolute; inset: 10px; background: rgba(0,0,0,0.8); filter: blur(20px); z-index: -1; border-radius: 12px; animation: cardShadowEntry 1s ease-out forwards 0.2s; opacity: 0;"></div>
                        ${idCardHTML}
                    </div>

                    <div class="glass-card">
                        <!-- Holographic Glare Sweep -->
                        <div class="glass-glare"></div>

                        <!-- Data Stream Strip (Encrypted Hash simulation) -->
                        <div style="position: absolute; right: 8px; top: 15px; bottom: 15px; width: 14px; overflow: hidden; opacity: 0.15; font-family: 'Courier New', monospace; font-size: 0.45rem; color: ${finalStatusColor}; word-break: break-all; line-height: 1.1; text-align: center; z-index: 1;">
                            <div style="animation: streamScroll 10s linear infinite;">
                                0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 0A 1B 2C 3D 4E 5F 67 89 
                            </div>
                        </div>

                        <!-- Glow Aura -->
                        <div style="position:absolute; inset:0; background: radial-gradient(circle at 50% 0%, ${finalStatusColor}15, transparent 80%); z-index:0; pointer-events:none;"></div>
                        
                        <!-- Transparent Watermark Logo -->
                        <div style="position:absolute; inset:0; display:flex; justify-content:center; align-items:center; z-index:2; pointer-events:none; opacity: 0.03; mix-blend-mode: screen; animation: spin-slow 60s linear infinite;">
                            <img src="logo.jpg" style="width: 250px; height: 250px; object-fit: contain; filter: grayscale(100%) contrast(200%);" onerror="this.style.display='none'">
                        </div>

                        <!-- Scanner Laser -->
                        <div class="scanner-laser"></div>
                        
                        <div class="glass-content" style="border: none; padding: 0; position:relative; z-index:4; transform-style: preserve-3d; transform: translateZ(10px);">
                            <div class="glass-header reveal-item" style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom:20px; margin-bottom: 20px; display:flex; align-items:center; gap: 12px; animation-delay: 1.5s;">
                                <div class="emblem" style="background: rgba(0,0,0,0.6); padding: 6px; border-radius: 50%; box-shadow: 0 0 15px ${finalStatusColor}40, inset 0 0 8px rgba(255,255,255,0.1);">
                                    <img src="logo.jpg" alt="Logo" style="border-radius:50%; width: 50px; height: 50px; object-fit: cover;" onerror="this.style.display='none'">
                                </div>
                                <div class="emblem-text" style="font-family: 'Rajdhani', sans-serif; display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                                    <span style="font-size: 1.3rem; font-weight: 800; background: linear-gradient(90deg, #DAA520, #DAA520); -webkit-background-clip: text; color: transparent; letter-spacing: 1px; text-shadow: 0 0 20px rgba(255,215,0,0.3);">UPTD PUSKESMAS WANA</span>
                                    <div style="font-size: 0.55rem; color: #94a3b8; letter-spacing: 5px; text-transform: uppercase; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">Biometric Clearance System</div>
                                </div>
                            </div>
                            
                            <div class="glass-status reveal-item" style="border: none; background: rgba(0,0,0,0.3); border-radius: 12px; padding: 20px; margin-bottom: 25px; box-shadow: inset 0 2px 20px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05); position: relative; animation-delay: 1.7s;">
                                <div style="position: absolute; top:0; left:0; width:4px; height:100%; background: ${finalStatusColor}; box-shadow: 0 0 15px ${finalStatusColor}; border-radius: 12px 0 0 12px;"></div>
                                <div style="font-family: 'Rajdhani', sans-serif; font-size: 2.2rem; font-weight: 800; color: ${finalStatusColor}; text-shadow: 0 0 15px ${finalStatusColor}80; display: flex; align-items: center; justify-content: center; gap: 15px; letter-spacing: 2px;">
                                    ${finalStatusText} 
                                </div>
                                <div class="text-sm mt-4 mb-2 text-center" style="font-family: 'Inter', sans-serif; color: #ffffff; font-weight: 700; letter-spacing: 0.5px; text-shadow: 0 2px 10px rgba(0,0,0,1);">
                                    ${finalMessageHTML}
                                </div>
                            </div>
                            
                            <div class="glass-details" style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.03); display: flex; flex-direction: column; gap: 12px; text-align: left; transform-style: preserve-3d;">
                                <div class="reveal-item" style="display:flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 10px; animation-delay: 1.9s;">
                                    <span style="color:#64748b; font-size:0.75rem; letter-spacing: 1px; font-weight:600; text-transform:uppercase;">Identitas Pegawai</span>
                                    <span style="color:#fff; font-weight:800; font-size:0.85rem; letter-spacing: 0.5px; text-shadow: 0 2px 5px rgba(0,0,0,0.8);">${display_name}</span>
                                </div>
                                <div class="reveal-item" style="display:flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 10px; animation-delay: 2.0s;">
                                    <span style="color:#64748b; font-size:0.75rem; letter-spacing: 1px; font-weight:600; text-transform:uppercase;">Tanggal Validasi</span>
                                    <span style="color:#e2e8f0; font-size:0.85rem; font-family:'Courier New', monospace; text-shadow: 0 2px 5px rgba(0,0,0,0.8);">${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                                </div>
                                <div class="reveal-item" style="display:flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 10px; animation-delay: 2.1s;">
                                    <span style="color:#64748b; font-size:0.75rem; letter-spacing: 1px; font-weight:600; text-transform:uppercase;">Waktu Sistem</span>
                                    <span style="color:#e2e8f0; font-size:0.85rem; font-family:'Courier New', monospace; text-shadow: 0 2px 5px rgba(0,0,0,0.8);">${serverTimestamp}</span>
                                </div>
                                <div class="reveal-item" style="display:flex; justify-content: space-between; align-items: center; padding-top: 5px; animation-delay: 2.2s;">
                                    <span style="color:#64748b; font-size:0.7rem; letter-spacing: 1px; font-weight:600; text-transform:uppercase;">Keamanan</span>
                                    <span style="color:${finalStatusColor}; background: ${finalStatusColor}15; padding: 4px 10px; border-radius: 4px; font-weight:bold; font-size:0.75rem; border: 1px solid ${finalStatusColor}40; letter-spacing: 1px; box-shadow: 0 0 10px ${finalStatusColor}20; animation: pulseGlow 2s infinite;">
                                        <i class="fa-solid fa-lock" style="margin-right: 4px;"></i> ENCRYPTED (SHA-256)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Cooldown Bar (Keep this for UX) -->
                <div class="cooldown-track" style="position: fixed; bottom: 0; left: 0; z-index: 100;"><div id="cooldownBar" class="cooldown-progress" style="background: ${finalStatusColor}; box-shadow: 0 0 20px ${finalStatusColor};"></div></div>
            `;

            // [NEW] Parallax Mouse Move Effect
            const container = successOverlay.querySelector('.holographic-container > div');
            const stamp = successOverlay.querySelector('.academic-stamp');
            if (container) {
                successOverlay.onmousemove = (e) => {
                    const rect = container.getBoundingClientRect();
                    const x = e.clientX - rect.left - rect.width / 2;
                    const y = e.clientY - rect.top - rect.height / 2;
                    const rotateY = -x / 40; // Sensitivitas
                    const rotateX = y / 40;
                    container.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;

                     // NEW: Elegant Layered Parallax
                     const content = stamp.querySelector('.stamp-content');
                     if (content) {
                        content.style.transform = `translateZ(50px) rotateY(${rotateY * 0.4}deg) rotateX(${rotateX * 0.4}deg)`;
                     }
                     const seal = stamp.querySelector('.security-seal');
                     if (seal) {
                        seal.style.transform = `translateZ(80px) rotate(${Date.now() / 60}deg)`;
                     }
                     
                     // Fresnel Angle Update
                     const angle = Math.atan2(y, x) * (180 / Math.PI);
                     stamp.style.setProperty('--angle', `${angle}deg`);
                     stamp.style.setProperty('--fresnel-opacity', Math.min(0.5, Math.hypot(x, y) / 400));
                };
            }

            // [UPDATE] Trigger Shutter Sequence (Sequence: Startup -> Verify -> Open)
            setTimeout(() => {
                const shutter = document.getElementById('cyber-shutter');
                if(shutter) {
                    // Step 1: Munculkan Digital Seal (Startup)
                    shutter.classList.add('shutter-startup');
                    SoundFX.play('scan');
                    
                    setTimeout(() => {
                        // Step 2: Kunci Bergetar (Verify/Crack)
                        shutter.classList.add('shutter-crack');
                        SoundFX.play('shutter_crack');
                        triggerScreenFlash(finalStatusColor);
                        
                        setTimeout(() => {
                            // Step 3: Pintu Terbuka (Open)
                            shutter.classList.add('shutter-open');
                        }, 1200); 
                    }, 1000);
                }
            }, 500); // Jeda awal sebelum animasi dimulai

            // Animate hash
            animateHash('validation-hash');

            // Trigger Screen Flash on Stamp Impact
            setTimeout(() => {
                triggerScreenFlash(finalStatusColor); // Flash dipindah ke saat Impact (Stempel Menghantam)
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
                <style>
                    @keyframes spark-fall {
                        0% { top: 0%; opacity: 1; transform: scale(1); }
                        100% { top: 100%; opacity: 0; transform: scale(0); }
                    }
                </style>
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
        isTargetLocked = false; // Restored
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
        setSystemTheme('IDLE'); // Reset Theme // Restored
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
            ctx.fillStyle = Math.random() > 0.95 ? '#FFF' : '#F59E0B';
            
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
    if (typeof BABYLON === 'undefined' || !BABYLON.Engine) {
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
    return; // Fungsi injeksi display ambulans dihapus.
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

    // [NEW] Panggil roster segera saat startup agar tidak menunggu 10 detik pertama
    updatePersonnelRoster();
    // Sinkronisasi data awal
    setTimeout(updatePersonnelRoster, 2000);

    // [NEW] Auto-refresh roster setiap 10 detik agar status DL/Manual muncul otomatis tanpa reload
    setInterval(() => {
        // Only attempt refresh if network is detected to reduce log spam
        if (navigator.onLine) updatePersonnelRoster();
    }, 10000);

    // [NEW] Jalankan Auto Scroll untuk Panel Kehadiran
    startRosterAutoScroll();

    // Start dynamic radar telemetry updater
    const teleKey = document.getElementById('teleKey');
    const telePosX = document.getElementById('telePosX');
    const telePosY = document.getElementById('telePosY');
    const telePing = document.getElementById('telePing');

    setInterval(() => {
        if (teleKey) {
            const randHex = '0x' + Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, '0');
            teleKey.textContent = randHex;
        }
        if (telePosX) {
            const randX = (115 + Math.random() * 0.05).toFixed(4); // Simulasi koordinat geografis
            telePosX.textContent = randX;
        }
        if (telePosY) {
            const randY = (-5 - Math.random() * 0.05).toFixed(4);
            telePosY.textContent = randY;
        }
        if (telePing) {
            const randPing = Math.floor(Math.random() * 15 + 8) + 'ms';
            telePing.textContent = randPing;
        }
    }, 300);

    // CSS ADJUSTMENT: Geser area scan (Video Container) sedikit ke atas
    if (videoContainer) {
        // Disabled: videoContainer.style.marginTop = "-90px"; // Restored
        videoContainer.style.marginTop = "0px";
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
            box-shadow: 0 0 15px #DAA520, inset 0 0 10px #DAA520;
            border-color: #DAA520;
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

    /* --- GOD-TIER ROSTER STYLES --- */
    @keyframes miniScanline {
        0% { transform: translateY(-100%); opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        100% { transform: translateY(300%); opacity: 0; }
    }
    @keyframes telemetryBar {
        0%, 100% { height: 30%; }
        20% { height: 100%; }
        40% { height: 50%; }
        60% { height: 80%; }
        80% { height: 20%; }
    }
    @keyframes radarPing {
        0% { transform: scale(0.8); opacity: 0.8; }
        100% { transform: scale(2.5); opacity: 0; }
    }
    .roster-card-3d {
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s ease, border-color 0.4s ease;
        transform-style: preserve-3d;
        perspective: 1000px;
    }
    .roster-card-3d:hover {
        transform: scale(1.02) rotateX(4deg) rotateY(-4deg) translateZ(15px);
        z-index: 50;
    }
    .hex-bg-pattern {
        background-image: 
            radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            radial-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px);
        background-position: 0 0, 5px 5px;
        background-size: 10px 10px;
    }
    `;
    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
}

injectScanningStyles();

// =============================================================================
// 9. MANUAL NIP INPUT & BARCODE SCANNER INTEGRATION
// =============================================================================
const manualNipInput = document.getElementById('manualNipInput');
if (manualNipInput) {
    // Tangkap input saat tombol Enter ditekan
    manualNipInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const nip = manualNipInput.value.trim();
            if (nip) {
                console.log(`[MANUAL INPUT] Memproses NIP: ${nip}`);
                manualNipInput.value = ''; // Bersihkan input
                
                try {
                    // Cari nama pegawai berdasarkan NIP dari database wajah
                    let employeeName = nip; 
                    const db = await initDB();
                    const tx = db.transaction('faces', 'readonly');
                    const store = tx.objectStore('faces');
                    const request = store.get(nip);
                    
                    request.onsuccess = async () => {
                        if (request.result && request.result.name) {
                            employeeName = request.result.name;
                        }
                        // Jalankan proses absensi (karyawanId, imageBase64)
                        // Karena manual, imageBase64 kita kirim null/kosong
                        await processAttendance(nip, '');
                    };
                    
                    request.onerror = async () => {
                        console.warn("Gagal cek DB, melanjutkan proses manual.");
                        await processAttendance(nip, '');
                    };
                    
                } catch(err) {
                    console.error("Error manual input DB:", err);
                    await processAttendance(nip, '');
                }
            }
        }
    });

    // Auto-focus input supaya saat mengetik atau memakai barcode scanner langsung masuk
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            // Abaikan jika pakai shortcut admin (CTRL + SHIFT)
            if (!(e.ctrlKey || e.metaKey || e.altKey)) {
                manualNipInput.focus();
            }
        }
    });
}

