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
                    const color = detScore > 80 ? '#39FF14' : '#00eaff'; // Green if high conf, else Cyan

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
                
                if (score > 80) {
                    thresholdFill.style.backgroundColor = '#39FF14'; // Green
                    btnRegister.disabled = false;
                    btnRegister.classList.remove('opacity-50', 'cursor-not-allowed');
                    btnText.innerText = "CAPTURE & REGISTER";
                    document.getElementById('faceStatus').innerText = "TARGET LOCKED";
                    document.getElementById('faceStatus').className = "text-lg text-center mt-4 text-green-500 font-bold uppercase";
                } else {
                    thresholdFill.style.backgroundColor = '#00eaff'; // Blue
                    resetBtn();
                }
            } else {
                thresholdFill.style.width = '0%';
                thresholdStatus.innerText = '0%';
                resetBtn();
            }
        }
        // Schedule next frame
        setTimeout(onPlay, 100);
    };
    
    onPlay();
});

function resetBtn() {
    btnRegister.disabled = true;
    btnRegister.classList.add('opacity-50', 'cursor-not-allowed');
    btnText.innerText = "WAITING FOR FACE...";
    document.getElementById('faceStatus').innerText = "SEARCHING...";
    document.getElementById('faceStatus').className = "text-lg text-center mt-4 text-red-500 font-bold uppercase";
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
                @keyframes scan-vertical { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
                @keyframes hologram-flicker { 0%, 100% { opacity: 0.95; } 5% { opacity: 0.8; } 10% { opacity: 0.9; } 15% { opacity: 0.5; transform: skewX(2deg); } 20% { opacity: 0.95; transform: skewX(0deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                @keyframes shimmer { 0% { transform: translateX(-150%) skewX(-15deg); } 50%, 100% { transform: translateX(150%) skewX(-15deg); } }
                @keyframes float-particle { 0% { transform: translateY(0) scale(1); opacity: 0; } 20% { opacity: 0.8; } 100% { transform: translateY(-80px) scale(0); opacity: 0; } }
            </style>
            <div class="relative group perspective-[1000px]">
                <!-- Digital Particles Container -->
                <div class="absolute -inset-10 pointer-events-none z-0 overflow-hidden">
                    ${particles}
                </div>

                <!-- Holographic Card Container -->
                <div class="bg-gray-900/95 text-cyan-400 p-0 rounded-xl shadow-[0_0_50px_rgba(6,182,212,0.3)] max-w-xl w-full mx-4 border border-cyan-500/40 relative overflow-hidden font-mono backdrop-blur-xl transform transition-all duration-500 hover:scale-[1.02] hover:rotate-y-12 animate-[fadeIn_0.5s_ease-out] z-10">
                    
                    <!-- Animated Scanline -->
                    <div class="absolute left-0 w-full h-1 bg-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,1)] z-20" style="animation: scan-vertical 2s linear infinite;"></div>

                    <!-- Shimmer Effect -->
                    <div class="absolute inset-0 z-30 pointer-events-none bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent -skew-x-12 animate-[shimmer_3s_infinite_ease-in-out]"></div>

                    <!-- Decorative Background Grid -->
                    <div class="absolute inset-0 opacity-10 pointer-events-none z-0" 
                        style="background-image: linear-gradient(0deg, transparent 24%, #22d3ee 25%, #22d3ee 26%, transparent 27%, transparent 74%, #22d3ee 75%, #22d3ee 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, #22d3ee 25%, #22d3ee 26%, transparent 27%, transparent 74%, #22d3ee 75%, #22d3ee 76%, transparent 77%, transparent); background-size: 30px 30px;">
                    </div>
                    
                    <div class="p-8 relative z-10">
                        <!-- Header -->
                        <div class="flex justify-between items-start mb-8 border-b border-cyan-800/50 pb-6">
                            <div>
                                <div class="flex items-center gap-4">
                                    <!-- Smart Card Chip -->
                                    <div class="w-14 h-10 bg-yellow-600/80 rounded-md relative overflow-hidden border border-yellow-400/50 shadow-inner">
                                        <div class="absolute top-1/2 left-0 w-full h-[1px] bg-black/40"></div>
                                        <div class="absolute left-1/3 top-0 w-[1px] h-full bg-black/40"></div>
                                        <div class="absolute left-2/3 top-0 w-[1px] h-full bg-black/40"></div>
                                    </div>
                                    <h2 class="text-5xl font-black tracking-tighter text-white italic drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]" style="animation: hologram-flicker 3s infinite;">IDENTITY</h2>
                                </div>
                                <div class="flex items-center gap-2 mt-1">
                                    <div class="h-2 w-2 bg-green-500 rounded-full animate-ping"></div>
                                    <p class="text-sm text-cyan-500 font-bold tracking-[0.3em] uppercase">PUSKESMAS WANA</p>
                                </div>
                            </div>
                            <!-- Rotating Logo -->
                            <div class="w-14 h-14 border border-cyan-500/30 rounded-full flex items-center justify-center bg-cyan-950/30 relative">
                                <div class="absolute inset-0 border-t-2 border-cyan-400 rounded-full animate-spin"></div>
                                <div class="absolute inset-2 border-b-2 border-cyan-600 rounded-full animate-spin" style="animation-direction: reverse; animation-duration: 2s;"></div>
                                <span class="text-[10px] font-bold text-cyan-300">ID</span>
                            </div>
                        </div>
                        
                        <!-- Main Content: Horizontal Layout -->
                        <div class="flex flex-row gap-8 items-center mb-8">
                            <!-- Photo Frame -->
                            <div class="relative w-36 h-36 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                                <div class="absolute inset-0 border border-cyan-500/50 rounded-lg"></div>
                                <!-- Tech Corners -->
                                <div class="absolute -top-0.5 -left-0.5 w-2 h-2 border-t-2 border-l-2 border-cyan-300"></div>
                                <div class="absolute -top-0.5 -right-0.5 w-2 h-2 border-t-2 border-r-2 border-cyan-300"></div>
                                <div class="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b-2 border-l-2 border-cyan-300"></div>
                                <div class="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b-2 border-r-2 border-cyan-300"></div>
                                
                                <img src="${photoData}" class="w-full h-full object-cover rounded-lg opacity-90 grayscale-[20%] contrast-125">
                                <div class="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent animate-pulse"></div>
                            </div>
                            
                            <!-- Info Section -->
                            <div class="flex-1 overflow-hidden">
                                <h1 id="card-name" class="text-3xl font-bold text-white mb-2 tracking-tight truncate drop-shadow-md min-h-[40px]"></h1>
                                <div class="flex items-center mb-4">
                                    <p id="card-role" class="text-lg font-mono text-cyan-300 tracking-widest bg-cyan-900/40 px-3 py-1 rounded border border-cyan-500/20 min-h-[28px]"></p>
                                </div>
                                
                                <div class="w-full bg-gray-800/50 h-2 rounded-full overflow-hidden mt-2">
                                    <div class="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 w-full animate-[progress-indeterminate_2s_ease-in-out_infinite]"></div>
                                </div>
                                <p class="text-xs text-cyan-600 font-mono mt-2 text-right">BIOMETRIC VERIFIED</p>
                            </div>
                        </div>
                        
                        <!-- Data Grid -->
                        <div class="grid grid-cols-3 gap-4 bg-black/40 p-4 rounded border border-cyan-900/50 mb-6 relative overflow-hidden">
                            <div class="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
                            <div class="col-span-2">
                                <p class="text-xs text-gray-500 uppercase font-bold">ID Reference</p>
                                <p class="font-mono text-2xl text-white tracking-widest leading-none mt-1 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">${id}</p>
                            </div>
                            <div class="text-right border-l border-cyan-900/50 pl-2 flex flex-col justify-center">
                                <p class="text-xs text-gray-500 uppercase font-bold">Status</p>
                                <p class="font-mono text-sm text-green-400 font-bold mt-1 bg-green-900/20 px-2 py-0.5 rounded">ACTIVE</p>
                            </div>
                        </div>

                        <!-- Footer / Barcode & QR -->
                        <div class="flex justify-between items-end pt-4 border-t border-cyan-900/30">
                            <div class="flex flex-col gap-1">
                                <div class="flex gap-0.5 h-8 items-end opacity-60">
                                    <div class="w-0.5 h-full bg-cyan-400"></div>
                                    <div class="w-0.5 h-3/4 bg-cyan-400"></div>
                                    <div class="w-0.5 h-1/2 bg-cyan-400"></div>
                                    <div class="w-1 h-full bg-cyan-400"></div>
                                    <div class="w-0.5 h-2/3 bg-cyan-400"></div>
                                    <div class="w-1 h-1/3 bg-cyan-400"></div>
                                    <div class="w-0.5 h-full bg-cyan-400"></div>
                                    <div class="w-0.5 h-3/4 bg-cyan-400"></div>
                                    <div class="w-1 h-1/2 bg-cyan-400"></div>
                                    <div class="w-0.5 h-full bg-cyan-400"></div>
                                    <div class="w-0.5 h-2/3 bg-cyan-400"></div>
                                    <div class="w-1 h-full bg-cyan-400"></div>
                                </div>
                                <p class="text-[10px] text-cyan-700 font-mono tracking-widest">SECURE ENCRYPTED ID // ${new Date().getFullYear()}</p>
                            </div>
                            
                            <!-- Simulated QR -->
                            <div class="w-14 h-14 border border-cyan-500/30 p-0.5 bg-black/50">
                                <div class="grid grid-cols-5 gap-0.5 w-full h-full">
                                    ${qrBlocks}
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
        if (result.success) log("Server", "Data synced to database ✅");
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