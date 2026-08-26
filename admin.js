const video = document.getElementById('videoElement');
const overlay = document.getElementById('overlay');
const btnRegister = document.getElementById('btnRegister');
const btnReset = document.getElementById('btnReset');
const btnText = document.getElementById('btnText');
const thresholdFill = document.getElementById('thresholdFill');
const thresholdStatus = document.getElementById('thresholdStatus');
const cameraSelect = document.getElementById('cameraSelect');
const logStream = document.getElementById('logStream');

let modelsLoaded = false;
let currentStream = null;

// Load Models
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('./models') // Better accuracy for registration
]).then(() => {
    modelsLoaded = true;
    log("System", "Biometric models loaded.");
    startVideo();
});

async function startVideo() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    cameraSelect.innerHTML = '';
    videoDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Camera ${cameraSelect.length + 1}`;
        cameraSelect.appendChild(option);
    });

    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
            currentStream = stream;
            log("System", "Video stream initialized.");
        })
        .catch(err => log("Error", "Camera access denied."));
}

video.addEventListener('play', () => {
    const canvas = overlay;
    const displaySize = { width: video.clientWidth, height: video.clientHeight };
    faceapi.matchDimensions(canvas, displaySize);

    // FIX: Gunakan recursive function daripada setInterval untuk mencegah tumpukan proses (Memory Leak)
    const onPlay = async () => {
        if (!video.paused && !video.ended && modelsLoaded) {
            // Use TinyFace for fast detection loop
            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks();

            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            // Clear canvas
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

            if (detections.length > 0) {
                // FIX: Pilih wajah dengan area terbesar (terdekat), bukan sembarang index [0]
                const face = detections.reduce((prev, current) => {
                    return (prev.detection.box.area > current.detection.box.area) ? prev : current;
                });
                
                const score = Math.round(face.detection.score * 100);
                
                // Draw UI
                // Custom High-Tech HUD Drawing
                const ctx = canvas.getContext('2d');
                resizedDetections.forEach(det => {
                    const { x, y, width, height } = det.detection.box;
                    const detScore = Math.round(det.detection.score * 100);
                    
                    // Kriteria Kualitas Wajah
                    const isHighConf = detScore >= 90; // Naikkan ke 90%
                    const isCloseEnough = width > 110; // [UPDATE] Batas jarak dilonggarkan (150 -> 110)
                    const centerX = x + width / 2;
                    const isCentered = centerX > canvas.width * 0.2 && centerX < canvas.width * 0.8; // [UPDATE] Area tengah diperluas

                    const isQualityOk = isHighConf; // [UPDATE] Hijau jika 90% (Abaikan posisi ketat untuk visual)
                    const color = isQualityOk ? '#39FF14' : '#00eaff'; // Green if perfect, else Cyan

                    ctx.save();
                    
                    // 1. Corner Brackets (Thick & Glowing)
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 3;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 15;
                    const lineLen = 25;

                    // Top-Left
                    ctx.beginPath(); ctx.moveTo(x, y + lineLen); ctx.lineTo(x, y); ctx.lineTo(x + lineLen, y); ctx.stroke();
                    // Top-Right
                    ctx.beginPath(); ctx.moveTo(x + width - lineLen, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + lineLen); ctx.stroke();
                    // Bottom-Right
                    ctx.beginPath(); ctx.moveTo(x + width, y + height - lineLen); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width - lineLen, y + height); ctx.stroke();
                    // Bottom-Left
                    ctx.beginPath(); ctx.moveTo(x + lineLen, y + height); ctx.lineTo(x, y + height); ctx.lineTo(x, y + height - lineLen); ctx.stroke();

                    // 2. Inner Frame (Thin & Transparent)
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 0.4;
                    ctx.strokeRect(x + 5, y + 5, width - 10, height - 10);
                    ctx.globalAlpha = 1.0;

                    // 3. Header Label
                    ctx.fillStyle = color;
                    ctx.font = 'bold 12px "Share Tech Mono"';
                    ctx.fillText(`TARGET_ID [${detScore}%]`, x, y - 10);
                    
                    // 4. Bottom Scanning Bar
                    ctx.fillRect(x, y + height + 5, width * (detScore / 100), 3);
                    
                    ctx.restore();
                });
                
                // Update Threshold UI
                thresholdFill.style.width = `${score}%`;
                thresholdStatus.innerText = `${score}%`;
                
                // Validasi Kualitas sebelum Register Aktif
                const isCloseEnough = face.detection.box.width > 110; // [UPDATE] Batas jarak dilonggarkan (180 -> 110)
                const centerX = face.detection.box.x + face.detection.box.width / 2;
                const isCentered = centerX > canvas.width * 0.2 && centerX < canvas.width * 0.8; // [UPDATE] Area tengah diperluas

                // [UPDATE] Tombol muncul jika Score >= 90% (Syarat jarak/posisi dibuat opsional)
                if (score >= 90) {
                    thresholdFill.style.backgroundColor = '#39FF14'; // Green
                    btnRegister.disabled = false;
                    btnRegister.classList.remove('opacity-50', 'cursor-not-allowed');
                    btnText.innerText = "CAPTURE & REGISTER";
                    document.getElementById('faceStatus').innerText = "TARGET LOCKED";
                    document.getElementById('faceStatus').className = "text-lg text-center mt-4 text-green-500 font-bold uppercase";
                } else if (!isCloseEnough) {
                    resetBtn("MOJO LEBIH DEKAT (MOVE CLOSER)");
                } else if (!isCentered) {
                    resetBtn("POSISIKAN DI TENGAH");
                } else {
                    thresholdFill.style.backgroundColor = '#00eaff'; // Blue
                    resetBtn("HOLD STILL...");
                }
            } else {
                thresholdFill.style.width = '0%';
                thresholdStatus.innerText = '0%';
                resetBtn("WAITING FOR FACE...");
            }
        }
        // Schedule next frame
        setTimeout(onPlay, 100);
    };
    
    onPlay();
});

function resetBtn(msg = "WAITING FOR FACE...") {
    btnRegister.disabled = true;
    btnRegister.classList.add('opacity-50', 'cursor-not-allowed');
    btnText.innerText = msg;
    document.getElementById('faceStatus').innerText = msg === "WAITING FOR FACE..." ? "SEARCHING..." : "ADJUST POSITION";
    document.getElementById('faceStatus').className = "text-lg text-center mt-4 text-amber-500 font-bold uppercase";
}

/**
 * Menambahkan animasi efek ketik pada sebuah elemen.
 * @param {HTMLElement} element - Elemen HTML yang akan dianimasikan.
 * @param {string} text - Teks yang akan ditampilkan.
 * @param {number} [speed=80] - Kecepatan ketik dalam milidetik.
 * @param {function} [callback] - Fungsi yang dijalankan setelah animasi selesai.
 */
function animateTypewriter(element, text, speed = 80, callback) {
    if (!element) return;
    element.textContent = '';
    let i = 0;
    const interval = setInterval(() => {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
        } else {
            clearInterval(interval);
            if (callback) callback();
        }
    }, speed);
}

btnRegister.addEventListener('click', async () => {
    const id = document.getElementById('regIdKaryawan').value;
    const name = document.getElementById('regNama').value;
    const role = document.getElementById('regJabatan').value;

    if (!id || !name) {
        alert("Please fill in ID and Name.");
        return;
    }

    btnText.innerText = "PROCESSING...";
    
    // Use SSD MobileNet for high quality descriptor extraction
    const detection = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (detection) {
        // 1. Ambil Snapshot Foto untuk Database
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const photoData = canvas.toDataURL('image/jpeg', 0.7);

        saveToLocalStorage(id, name, role, detection.descriptor);
        saveToServer(id, name, role, detection.descriptor, photoData); // Kirim ke Server
        
        // Flash effect
        const flash = document.getElementById('flashEffect');
        flash.style.opacity = 1;
        setTimeout(() => flash.style.opacity = 0, 200);

        // Show Success Overlay (ID Card Style)
        const successOverlay = document.getElementById('regSuccessOverlay');
        
        // Generate random QR blocks for visual effect
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

        successOverlay.innerHTML = `
            <style>
                @keyframes scan-vertical { 0% { top: 0%; opacity: 0; } 10% { opacity: 0.5; } 90% { opacity: 0.5; } 100% { top: 100%; opacity: 0; } }
                @keyframes subtle-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                @keyframes shimmer { 0% { transform: translateX(-150%) skewX(-15deg); } 50%, 100% { transform: translateX(150%) skewX(-15deg); } }
            </style>
            <div class="relative group perspective-[1000px]">
                <!-- Digital Particles Container -->
                <div class="absolute -inset-10 pointer-events-none z-0 overflow-hidden">
                    ${particles}
                </div>

                <!-- Holographic Card Container -->
                <div class="bg-slate-950/95 text-slate-200 p-0 rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] max-w-xl w-full mx-4 border border-slate-800/50 relative overflow-hidden font-sans backdrop-blur-2xl transform transition-all duration-700 hover:scale-[1.01] animate-[fadeIn_0.5s_ease-out] z-10">
                    
                    <!-- Animated Scanline -->
                    <div class="absolute left-0 w-full h-1 bg-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.5)] z-20" style="animation: scan-vertical 3s linear infinite;"></div>

                    <!-- Shimmer Effect -->
                    <div class="absolute inset-0 z-30 pointer-events-none bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-[shimmer_4s_infinite_ease-in-out]"></div>

                    <!-- Decorative Background Grid -->
                    <div class="absolute inset-0 opacity-10 pointer-events-none z-0" 
                        style="background-image: radial-gradient(circle, #475569 1px, transparent 1px); background-size: 20px 20px;">
                    </div>
                    
                    <div class="p-8 relative z-10">
                        <!-- Header -->
                        <div class="flex justify-between items-start mb-8 border-b border-slate-800 pb-6">
                            <div>
                                <div class="flex items-center gap-4">
                                    <!-- Smart Card Chip -->
                                    <div class="w-12 h-9 bg-gradient-to-br from-amber-200 via-amber-500 to-amber-700 rounded-md relative overflow-hidden border border-amber-400/30 shadow-lg">
                                        <div class="absolute top-1/2 left-0 w-full h-[1px] bg-black/20"></div>
                                        <div class="absolute left-1/3 top-0 w-[1px] h-full bg-black/20"></div>
                                        <div class="absolute left-2/3 top-0 w-[1px] h-full bg-black/20"></div>
                                    </div>
                                    <h2 class="text-4xl font-serif font-black tracking-widest text-slate-100 italic">PERSONNEL</h2>
                                </div>
                                <div class="flex items-center gap-2 mt-1">
                                    <div class="h-1.5 w-1.5 bg-amber-500 rounded-full"></div>
                                    <p class="text-xs text-amber-500/80 font-bold tracking-[0.4em] uppercase">UPTD PUSKESMAS WANA</p>
                                </div>
                            </div>
                            <!-- Professional Emblem -->
                            <div class="w-12 h-12 border border-slate-700 rounded-lg flex items-center justify-center bg-slate-900 relative">
                                <div class="w-8 h-8 flex items-center justify-center text-teal-600 bg-white/20 rounded-full"><i class="fa-solid fa-hospital"></i></div>
                            </div>
                        </div>
                        
                        <!-- Main Content: Horizontal Layout -->
                        <div class="flex flex-row gap-8 items-center mb-8">
                            <!-- Photo Frame -->
                            <div class="relative w-40 h-40 flex-shrink-0">
                                <div class="absolute -inset-1 bg-gradient-to-br from-amber-500/20 to-transparent rounded-2xl blur-sm"></div>
                                <img src="${photoData}" class="w-full h-full object-cover rounded-xl border border-slate-700 shadow-2xl relative z-10">
                            </div>
                            
                            <!-- Info Section -->
                            <div class="flex-1 overflow-hidden">
                                <h1 id="card-name" class="text-3xl font-bold text-white mb-1 tracking-tight truncate min-h-[40px]"></h1>
                                <div class="flex items-center mb-4">
                                    <p id="card-role" class="text-lg text-amber-500 font-medium tracking-wide min-h-[28px] uppercase"></p>
                                </div>
                                
                                <div class="w-full bg-slate-900 h-1 rounded-full overflow-hidden mt-2">
                                    <div class="h-full bg-amber-500 w-1/3"></div>
                                </div>
                                <p class="text-[10px] text-slate-500 font-mono mt-2 tracking-widest uppercase">Biometric Authenticated</p>
                            </div>
                        </div>
                        
                        <!-- Data Grid -->
                        <div class="grid grid-cols-3 gap-4 bg-slate-900/50 p-5 rounded-xl border border-slate-800 mb-6 relative overflow-hidden">
                            <div class="col-span-2">
                                <p class="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Registration ID</p>
                                <p class="font-mono text-2xl text-slate-100 tracking-[0.2em] leading-none mt-1">${id}</p>
                            </div>
                            <div class="text-right border-l border-slate-800 pl-4 flex flex-col justify-center">
                                <p class="text-[10px] text-slate-500 uppercase font-bold">Access</p>
                                <p class="text-sm text-emerald-500 font-bold mt-1 uppercase tracking-widest">Verified</p>
                            </div>
                        </div>

                        <!-- Footer / Barcode & QR -->
                        <div class="flex justify-between items-end pt-4 border-t border-slate-800">
                            <div class="flex flex-col gap-1">
                                <div class="flex gap-0.5 h-6 items-end opacity-30">
                                    ${Array(15).fill(0).map(() => `<div class="w-0.5 bg-slate-400" style="height: ${Math.random()*100}%"></div>`).join('')}
                                </div>
                                <p class="text-[9px] text-slate-600 font-mono tracking-[0.3em]">AETHER-SYSTEM-CORE v4.5</p>
                            </div>
                            
                            <!-- Simulated QR -->
                            <div class="w-12 h-12 border border-slate-800 p-1 bg-white/[0.03]">
                                <div class="grid grid-cols-5 gap-0.5 w-full h-full">
                                    ${Array(25).fill(0).map(() => `<div class="w-full h-full ${Math.random() > 0.5 ? 'bg-amber-500/40' : 'bg-transparent'}"></div>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        successOverlay.classList.remove('hidden');
        successOverlay.style.display = 'flex'; // Ensure flex centering
        successOverlay.style.alignItems = 'center';
        successOverlay.style.justifyContent = 'center';

        playTechSound(); // Play SFX

        // Panggil fungsi animasi ketik setelah overlay dibuat
        const cardNameElement = document.getElementById('card-name');
        const cardRoleElement = document.getElementById('card-role');
        
        animateTypewriter(cardNameElement, name.toUpperCase(), 80, () => {
            animateTypewriter(cardRoleElement, role.toUpperCase(), 50);
        });

        log("Success", `Subject ${name} (${id}) archived.`);
        
        setTimeout(() => {
            successOverlay.classList.add('hidden');
            successOverlay.style.display = ''; // Reset style
            document.getElementById('regIdKaryawan').value = '';
            document.getElementById('regNama').value = '';
            document.getElementById('regJabatan').value = '';
        }, 10000);
    } else {
        alert("Face capture failed. Please hold still.");
    }
});

// --- TOMBOL RESET FORM ---
if (btnReset) {
    btnReset.addEventListener('click', () => {
        document.getElementById('regIdKaryawan').value = '';
        document.getElementById('regNama').value = '';
        document.getElementById('regJabatan').value = '';
        log("System", "Form input cleared.");
    });
}

function saveToLocalStorage(id, name, role, descriptor) {
    let db = JSON.parse(localStorage.getItem('aether_users') || '[]');
    // Convert Float32Array to normal array for JSON storage
    const descriptorArray = Array.from(descriptor);
    
    db.push({ id, name, role, descriptor: descriptorArray });
    localStorage.setItem('aether_users', JSON.stringify(db));
}
async function saveToServer(id, name, role, descriptor, photo) {
    try {
        const descriptorArray = Array.from(descriptor);
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_karyawan: id,
                nama: name,
                jabatan: role,
                face_descriptor: JSON.stringify(descriptorArray),
                foto: photo
            })
        });

        if (response.status === 404) {
            log("Server", "⚠️ Endpoint /register belum ada di Server (404).");
            return;
        }

        const result = await response.json();
        if (result.success) log("Server", result.message || "Data synced to database ✅");
        else log("Server Error", result.message || "Upload failed ❌");
    } catch (error) {
        log("Network", "Gagal koneksi ke server database (Mode Offline).");
    }
}

function playTechSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        // Oscillator 1: High pitch sweep
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(800, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain1.gain.setValueAtTime(0.05, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.3);
    } catch (e) { 
        // Ignore audio errors
    }
}

function log(type, message) {
    const div = document.createElement('div');
    div.innerHTML = `<span class="text-gray-500">[${new Date().toLocaleTimeString()}]</span> <span class="${type === 'Error' ? 'text-red-500' : 'text-cyan-400'}">${type}: ${message}</span>`;
    logStream.prepend(div);
}

// --- AUTO-FILL FORM FROM URL PARAMS (Integration with Dashboard) ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('id')) {
        const idField = document.getElementById('regIdKaryawan');
        const nameField = document.getElementById('regNama');
        const roleField = document.getElementById('regJabatan');

        if (idField) {
            idField.value = params.get('id');
            // Opsional: Kunci field ID agar tidak bisa diubah jika dari dashboard
            idField.readOnly = true; 
            idField.classList.add('opacity-50', 'cursor-not-allowed');
        }
        if (nameField) nameField.value = params.get('name') || '';
        if (roleField) roleField.value = params.get('role') || '';
        
        log("System", `Pre-filled data for ID: ${params.get('id')}`);
    }
});