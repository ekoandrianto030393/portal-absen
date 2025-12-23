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

    setInterval(async () => {
        if (!modelsLoaded) return;

        // Use TinyFace for fast detection loop
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // Clear canvas
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

        if (detections.length > 0) {
            const face = detections[0];
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
    }, 100);
});

function resetBtn() {
    btnRegister.disabled = true;
    btnRegister.classList.add('opacity-50', 'cursor-not-allowed');
    btnText.innerText = "WAITING FOR FACE...";
    document.getElementById('faceStatus').innerText = "SEARCHING...";
    document.getElementById('faceStatus').className = "text-lg text-center mt-4 text-red-500 font-bold uppercase";
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

        // Show Success Overlay
        document.getElementById('overlayRegId').innerText = id;
        document.getElementById('regSuccessOverlay').classList.remove('hidden');
        log("Success", `Subject ${name} (${id}) archived.`);
        
        setTimeout(() => {
            document.getElementById('regSuccessOverlay').classList.add('hidden');
            document.getElementById('regIdKaryawan').value = '';
            document.getElementById('regNama').value = '';
        }, 3000);
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

function log(type, message) {
    const div = document.createElement('div');
    div.innerHTML = `<span class="text-gray-500">[${new Date().toLocaleTimeString()}]</span> <span class="${type === 'Error' ? 'text-red-500' : 'text-cyan-400'}">${type}: ${message}</span>`;
    logStream.prepend(div);
}