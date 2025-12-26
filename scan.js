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


const cameraSelect = document.getElementById('cameraSelect');

const stealthToggle = document.getElementById('stealthToggle');
const stealthIcon = document.getElementById('stealthIcon');

const cpuLoadBar = document.getElementById('cpuLoadBar');
const cpuLoadText = document.getElementById('cpuLoad');
const memUsageBar = document.getElementById('memUsageBar');
const memUsageText = document.getElementById('memUsage');
const matchThresholdBar = document.getElementById('matchThresholdBar');
const matchConfidenceText = document.getElementById('matchConfidenceText');
const dataStream = document.getElementById('dataStream');
const graphElement = document.getElementById('graph');

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

// --- AUDIO & VOICE ENGINE (WEB AUDIO API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

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
        gain.connect(audioCtx.destination);
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
        }
    },
    speak: (text) => {
        if (isStealthMode) return; // Mute jika Stealth Mode aktif
        if ('speechSynthesis' in window) {
            // Cancel previous speech
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.1; // Sedikit lebih cepat
            utterance.pitch = 0.9; // Sedikit lebih rendah (wibawa)
            utterance.volume = 1.0;
            
            // Coba cari suara bahasa Inggris yang bagus (Google US English biasanya ada)
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) || voices[0];
            if (preferredVoice) utterance.voice = preferredVoice;
            window.speechSynthesis.speak(utterance);
        }
    }
};

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
const AGENCY_NAME = 'PUSKESMASWANA'; // Nama Instansi Global

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

function drawHolographicMesh(ctx, landmarks) {
    const points = landmarks.positions;
    
    // Efek Denyut (Pulse) pada Mesh
    const time = Date.now() / 500;
    const alpha = 0.1 + 0.15 * Math.abs(Math.sin(time)); // Lebih transparan agar tidak menghalangi wajah

    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha + 0.1})`; // Cyan Pulse
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

    // 1. Electric Trail (Reflection Behind)
    const gradient = ctx.createLinearGradient(box.x, yPos, box.x, yPos - 50);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(box.x, yPos - 50, box.width, 50);

    // 2. Electric Core Line
    ctx.beginPath();
    ctx.moveTo(box.x, yPos);
    ctx.lineTo(box.x + box.width, yPos);
    ctx.strokeStyle = 'rgba(0, 255, 127, 0.8)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00FF7F';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00FFFF';
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// --- FITUR BARU: COMPLEX SCI-FI HUD ---
function drawSciFiHUD(ctx, x, y, w, h, color) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const radius = Math.max(w, h) * 0.65;
    const time = Date.now() / 1000;

    ctx.save();
    ctx.translate(cx, cy);

    // Ring 1: Putus-putus, Rotasi CW (Cepat)
    ctx.rotate(time * 0.8);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([15, 25]); // Garis putus-putus panjang
    ctx.stroke();
    ctx.setLineDash([]);

    // Ring 2: Solid Tipis, Rotasi CCW (Lambat)
    ctx.rotate(-time * 1.2); // Rotasi relatif terbalik
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.85, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Ring 3: Tech Ticks (Gerigi)
    ctx.rotate(time * 0.2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.1, -0.2, 0.2); // Busur di 4 sisi
        ctx.stroke();
    }

    ctx.restore();

    // Crosshair Tengah
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
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

// --- VISUAL FX: SCREEN FLASH ---
function triggerScreenFlash(color) {
    const flash = document.getElementById('screenFlash');
    if (flash) {
        flash.style.backgroundColor = color;
        flash.style.opacity = 0.4;
        setTimeout(() => flash.style.opacity = 0, 100);
    }
}

// --- VISUAL FX: PARTICLE BURST ---
function createParticleBurst(x, y, color) {
    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.style.cssText = `position:fixed; left:${x}px; top:${y}px; width:4px; height:4px; background:${color}; pointer-events:none; z-index:9999; border-radius:50%; box-shadow:0 0 5px ${color};`;
        document.body.appendChild(p);
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 100 + 50;
        const anim = p.animate([
            { transform: 'translate(0,0) scale(1)', opacity: 1 },
            { transform: `translate(${Math.cos(angle)*velocity}px, ${Math.sin(angle)*velocity}px) scale(0)`, opacity: 0 }
        ], { duration: 600, easing: 'cubic-bezier(0, .9, .57, 1)' });
        anim.onfinish = () => p.remove();
    }
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
            // Efek suara tik sangat halus (opsional)
            // if (i % 2 === 0) SoundFX.play('tick'); 
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
function drawSmartHUD(ctx, box, label, color, confidence) {
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
            matchThresholdBar.className = 'loader-fill'; // Hijau
            matchThresholdBar.style.background = 'linear-gradient(90deg, #00FF7F, #00FFFF)';
        } else if (confPercent >= 40) {
            matchThresholdBar.className = 'loader-fill'; // Kuning
            matchThresholdBar.style.background = 'linear-gradient(90deg, #FFD700, #FF00FF)';
        } else {
            matchThresholdBar.className = 'loader-fill-red'; // Merah
            matchThresholdBar.style.background = 'linear-gradient(90deg, #FF0055, #FF5500)';
        }
        matchConfidenceText.textContent = `${confPercent.toFixed(0)}%`;
    }
}

function updateDataStream() {
    if(!dataStream) return;
    
    // Setup style agar memenuhi panel (Matrix style block)
    if (dataStream.style.flexWrap !== 'wrap') {
        dataStream.innerHTML = '';
        dataStream.style.display = 'flex';
        dataStream.style.flexDirection = 'row'; // Horizontal
        dataStream.style.flexWrap = 'wrap'; // FILL THE PANEL
        dataStream.style.overflow = 'hidden';
        dataStream.style.alignContent = 'flex-start';
    }

    const chars = 'abcdefghijklmnopqrstuvwxyz';
    
    // Tambah beberapa karakter sekaligus agar terlihat cepat
    for (let i = 0; i < 4; i++) {
        const span = document.createElement('span');
        span.textContent = chars[Math.floor(Math.random() * chars.length)];
        
        // Style Gold & Huruf Kecil
        span.className = 'text-xs font-mono';
        span.style.color = '#FFD700'; // GOLD
        span.style.textShadow = '0 0 4px rgba(255, 215, 0, 0.6)'; // Glow
        span.style.width = '10px'; // Fixed width
        span.style.textAlign = 'center';
        
        dataStream.appendChild(span);
    }

    // Jaga agar panel penuh tapi tidak overflow memory (misal 400 karakter)
    while (dataStream.children.length > 400) {
        dataStream.removeChild(dataStream.firstChild);
    }
}

function updateGraph() {
    if(!graphElement) return;
    
    // UBAH KE VISUALIZER BAR (Gaya Spektrum Audio)
    if (!graphElement.classList.contains('visualizer-mode')) {
        graphElement.innerHTML = '';
        graphElement.classList.add('visualizer-mode');
        graphElement.style.display = 'flex';
        graphElement.style.alignItems = 'flex-end';
        graphElement.style.gap = '2px';
        graphElement.style.height = '100%';
        
        // Buat 30 bar
        for(let i=0; i<30; i++) {
            const bar = document.createElement('div');
            bar.style.flex = '1';
            bar.style.backgroundColor = '#00FFFF';
            bar.style.opacity = '0.7';
            bar.style.transition = 'height 0.1s ease, background-color 0.1s';
            graphElement.appendChild(bar);
        }
    }

    const bars = graphElement.children;
    const time = Date.now() / 200;
    
    for (let i = 0; i < bars.length; i++) {
        // Simulasikan gelombang sinus bergerak
        const height = Math.max(5, Math.abs(Math.sin(time + i * 0.3)) * 100);
        bars[i].style.height = `${height}%`;
        
        // Warna berdasarkan ketinggian (Heatmap)
        if (height > 80) bars[i].style.backgroundColor = '#FF0055'; // Merah Puncak
        else if (height > 50) bars[i].style.backgroundColor = '#FFD700'; // Kuning Tengah
        else bars[i].style.backgroundColor = '#00FFFF'; // Cyan Dasar
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
    if (!document.getElementById('siger-header-icon')) {
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
        
        if(mainTitle.parentNode) mainTitle.parentNode.insertBefore(sigerContainer, mainTitle);
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

// Interval cepat untuk animasi data stream & waveform
setInterval(() => {
    updateDataStream();
    updateGraph();
}, 100);

const api = {
    getDescriptors: async () => {
        try {
            const response = await fetch('/api/karyawan/descriptors');
            if (!response.ok) {
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
                throw new Error(`Invalid JSON received. Cek Console (F12) untuk melihat respons server.`);
            }
        } catch (error) {
            console.error('Error loading descriptors:', error);
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

        
        setStatusVisual(`${descriptors.length} ID Karyawan dimuat. SYSTEM READY.`, 'text-green-500');
        if(dbStatus) {
            dbStatus.textContent = 'ONLINE';
            dbStatus.className = 'text-green-500 font-bold';
        }
        logSystem(`Database loaded: ${descriptors.length} records.`, 'text-green-500');
        return descriptors;

    } catch (error) {
        console.error('Error loading descriptors:', error);
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

    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 }))
	.withFaceLandmarks()
        .withFaceDescriptor();

    if(!isProcessing) videoContainer.classList.remove('scan-success');

    if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const { box } = resizedDetections.detection;
        const { landmarks } = resizedDetections;

        drawHolographicMesh(context, landmarks);

        // --- GAMBAR EFEK BARU ---
        // drawScanningBeam(context, box); // Diganti dengan HUD Sci-Fi
        drawSciFiHUD(context, box.x, box.y, box.width, box.height, '#00FFFF');
        
        const nose = landmarks.getNose()[3]; // Titik tengah hidung
        // drawTargetLock(context, nose.x, nose.y, box.width * 0.3); // Diganti Sci-Fi HUD
        
 	    // Efek suara scanning ringan (opsional, bisa dimatikan jika terlalu berisik)
        if (Math.random() > 0.85) SoundFX.play('scan'); 

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
                    setStatusVisual('SUBJECT NOT AUTHORIZED. IDENTITY DENIED.', 'text-red-500');
                    SoundFX.speak('Access Denied');
                }
                
 		        userStatusDisplay.textContent = 'ACCESS DENIED';
                faceLabel = 'DENIED ACCESS';
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
            targetLabel = '';
            faceColor = '#FF00FF'; 
            setStatusVisual('WARNING: NO BIOMETRIC DATABASE FOUND.', 'text-red-500');
            lastKnownMatch = null;
        }
        
        // drawTechBracket(context, box.x, box.y, box.width, box.height, faceColor); // Diganti Sci-Fi HUD
        drawSciFiHUD(context, box.x, box.y, box.width, box.height, faceColor);
        
        // Gunakan Smart HUD baru
        drawSmartHUD(context, box, faceLabel, faceColor, confidence);
        drawDataWaterfall(context, box.x - 40, box.y, box.height, faceColor); // Matrix rain di kiri wajah

    } else {
        // Tidak ada deteksi wajah
        resetTargetData();
        updateSystemDiagnostics(0);
        setStatusVisual('SYSTEM READY. AWAITING TARGET...', 'text-gray-300', true);
        targetLabel = '';
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
        successOverlay.style.pointerEvents = 'none';
        
        // INIT OVERLAY BARU
        successOverlay.innerHTML = `
            <div style="
                position: relative;
                text-align: center;
                padding: 60px;
                color: #fff;
                background: rgba(5, 10, 15, 0.95);
                border: 2px solid ${HEADER_COLOR};
                box-shadow: 0 0 50px rgba(0, 255, 255, 0.2);
                border-radius: 15px;
                max-width: 90%;
                backdrop-filter: blur(10px); /* Kaca Buram */
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
                    SELAMAT DATANG DI ${AGENCY_NAME}
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
        
        const coloredName = `<span class="font-bold text-shadow-lg" style="color: ${NAME_HIGHLIGHT_COLOR}; text-shadow: 0 0 10px ${NAME_HIGHLIGHT_COLOR}, 0 0 5px #000;">${display_name}</span>`;

        let finalStatusText = 'ACCESS GRANTED';
        let finalMessageHTML = '';
        let finalBackground = ABSEN_NORMAL_BG;
        let finalStatusColor = PROFESSIONAL_STATUS_COLOR;
        
        // LOGIKA SUKSES/GAGAL
        if (result.success) {
            // AUDIO & VISUAL SUCCESS
            SoundFX.play('success');
            SoundFX.speak(`Welcome, ${display_name}`);
            triggerScreenFlash('#00FF7F');
            
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
                default: // Fallback untuk kasus sukses lainnya
                    finalStatusText = 'STATUS CONFIRMED';
                    finalMessageHTML = `Sistem mengkonfirmasi ${coloredName}. Absensi Anda untuk hari ini telah tercatat.`;
                    finalBackground = ABSEN_NORMAL_BG;
                    finalStatusColor = NAME_HIGHLIGHT_COLOR; 
            }

        } else {
            // --- GAGAL (MERAH atau KUNING) ---
            const isWarning = statusColor === 'yellow'; // Cek apakah ini peringatan atau error fatal

            SoundFX.play('error');
            // Panggil nama dalam notifikasi suara
            SoundFX.speak(isWarning ? `Notice, ${display_name}` : `Access Denied, ${display_name}`);
            triggerScreenFlash(isWarning ? '#FFD700' : '#FF0055');

            setStatusVisual(cleanMessage, isWarning ? 'text-amber-500' : 'text-red-500');
            userStatusDisplay.textContent = isWarning ? 'NOTICE' : 'DENIED';
            userStatusDisplay.className = 'text-lg font-bold ' + (isWarning ? 'text-amber-500' : 'text-red-500');

            // --- UPDATE: Penanganan Overlay Spesifik Berdasarkan Kode Server ---
            switch (result.result_code) {
                case 'OUT_OF_TIME_IN':
                    finalStatusText = 'DILUAR JAM MASUK';
                    // Pesan dari server sudah mengandung jam dari .env (misal: "Waktu diizinkan: 07:00 s/d 11:00")
                    finalMessageHTML = `<span style="color:#FF0055;">${cleanMessage}</span>`; 
                    break;
                case 'TOO_EARLY_OUT':
                    finalStatusText = 'PULANG TERLALU AWAL';
                    finalMessageHTML = `<span style="color:#FFD700;">${cleanMessage}</span>`;
                    break;
                case 'ALREADY_CHECKED_IN':
                    finalStatusText = 'MOHON TUNGGU'; // Cooldown
                    finalMessageHTML = cleanMessage;
                    break;
                case 'ALREADY_CHECKED_OUT':
                    finalStatusText = 'SUDAH PULANG';
                    finalMessageHTML = `${coloredName}, ${cleanMessage}`;
                    break;`${coloredName}, ${cleanMessage}`;
                    break;
                default:
                    finalStatusText = isWarning ? 'PERINGATAN' : 'ACCESS DENIED';
                    finalMessageHTML = `${coloredName} | ${cleanMessage}`;
            }

            // Background: Kuning untuk Warning (Waktu), Merah untuk Error (Wajah Tidak Dikenal)
            finalBackground = isWarning 
                ? `radial-gradient(circle, rgba(200, 150, 0, 0.8) 0%, rgba(100, 80, 0, 0.95) 100%)`
                : `radial-gradient(circle, rgba(255,0,85,0.7) 0%, rgba(153,0,0,0.9) 100%)`;
            
            finalStatusColor = isWarning ? '#FFD700' : '#FF0055';
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
                    background: rgba(0, 0, 0, 0.8); /* Latar belakang gelap transparan */
                    border: 3px solid ${finalStatusColor};
                    box-shadow: 0 0 60px ${finalStatusColor}40, inset 0 0 30px ${finalStatusColor}20;
                    border-radius: 20px;
                    position: relative;
                    max-width: 90%;
                    backdrop-filter: blur(5px);
                    /* EFEK 3D HOLOGRAM */
                    transform-style: preserve-3d;
                    animation: holoPopIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                ">
                    <!-- Decorative Corners -->
                    <div style="position: absolute; top: 20px; left: 20px; width: 40px; height: 40px; border-top: 4px solid ${finalStatusColor}; border-left: 4px solid ${finalStatusColor};"></div>
                    <div style="position: absolute; top: 20px; right: 20px; width: 40px; height: 40px; border-top: 4px solid ${finalStatusColor}; border-right: 4px solid ${finalStatusColor};"></div>
                    <div style="position: absolute; bottom: 20px; left: 20px; width: 40px; height: 40px; border-bottom: 4px solid ${finalStatusColor}; border-left: 4px solid ${finalStatusColor};"></div>
                    <div style="position: absolute; bottom: 20px; right: 20px; width: 40px; height: 40px; border-bottom: 4px solid ${finalStatusColor}; border-right: 4px solid ${finalStatusColor};"></div>

                    <!-- Holo Scan Line -->
                    <div class="holo-scan-line"></div>

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
                        SELAMAT DATANG DI ${AGENCY_NAME}
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
            
            // Trigger Particle Burst di tengah layar
            const rect = successOverlay.getBoundingClientRect();
            createParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, finalStatusColor);
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
        await new Promise(resolve => setTimeout(resolve, SUCCESS_COOLDOWN_MS)); 

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
                    /* EFEK 3D HOLOGRAM */
                    transform-style: preserve-3d;
                    animation: holoPopIn 0.5s ease-out forwards;
                ">
                     <h1 class="text-5xl lg:text-7xl font-extrabold mb-8 tracking-widest" style="
                        font-family: 'Courier New', monospace;
                        color: #00FFFF;
                        text-shadow: 0 0 10px #00FFFF;
                        text-transform: uppercase;
                        letter-spacing: 5px;
                    ">
                        SELAMAT DATANG DI ${AGENCY_NAME}
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
        if(successOverlay) {
            successOverlay.style.opacity = 0;
            successOverlay.style.pointerEvents = 'none';
        }
        logSystem('System ready for next scan.', 'text-gray-300');
        videoContainer.classList.remove('scan-success');
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
        return scene;
    };

    const scene = createScene();
    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
}

// --- START APP (setelah semua HTML siap) ---
document.addEventListener('DOMContentLoaded', () => {
    initBackground3D(); // Inisialisasi Background 3D
    runBootSequence(); // Jalankan Intro Booting
    initializeApp();
    animateTitle();
    updateClock(); // Panggil sekali agar jam langsung muncul, lalu interval akan mengambil alih

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