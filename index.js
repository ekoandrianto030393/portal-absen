const video = document.getElementById('videoElement');
const fpsCounter = document.getElementById('fpsCounter');
const accessLogs = document.getElementById('accessLogs');

// UI Elements
const subjectName = document.getElementById('subjectName');
const subjectRole = document.getElementById('subjectRole');
const subjectId = document.getElementById('subjectId');
const accessStatus = document.getElementById('accessStatus');
const statusIcon = document.getElementById('statusIcon');

let faceMatcher = null;
let lastLogTime = 0;

// Load Models & Data
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('./models')
]).then(async () => {
    log("System", "Neural networks initialized.");
    await loadLabeledImages();
    startVideo();
});

async function loadLabeledImages() {
    const db = JSON.parse(localStorage.getItem('aether_users') || '[]');
    
    if (db.length === 0) {
        log("Warning", "No biometric data found in local storage.");
        return;
    }

    const labeledDescriptors = db.map(user => {
        // Convert array back to Float32Array
        const descriptor = new Float32Array(user.descriptor);
        return new faceapi.LabeledFaceDescriptors(JSON.stringify(user), [descriptor]);
    });

    faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
    log("System", `Loaded ${db.length} identities into memory.`);
}

function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
        })
        .catch(err => console.error(err));
}

video.addEventListener('play', () => {
    const canvas = document.getElementById('overlay');
    const displaySize = { width: video.clientWidth, height: video.clientHeight };
    faceapi.matchDimensions(canvas, displaySize);

    let frameCount = 0;
    let lastTime = performance.now();

    setInterval(async () => {
        // FPS Calculation
        const now = performance.now();
        frameCount++;
        if (now - lastTime >= 1000) {
            fpsCounter.innerText = frameCount;
            frameCount = 0;
            lastTime = now;
        }

        if (!faceMatcher) return;

        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (resizedDetections.length > 0) {
            const result = resizedDetections[0];
            const bestMatch = faceMatcher.findBestMatch(result.descriptor);
            
            // Draw box
            const box = result.detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, { label: bestMatch.toString() });
            drawBox.draw(canvas);

            updateAccessUI(bestMatch);
        } else {
            resetUI();
        }
    }, 100);
});

function updateAccessUI(match) {
    if (match.label === 'unknown') {
        subjectName.innerText = "UNKNOWN";
        subjectRole.innerText = "INTRUDER ALERT";
        subjectId.innerText = "ID: ---";
        accessStatus.innerText = "DENIED";
        accessStatus.className = "text-4xl font-black uppercase tracking-widest text-red-600 status-indicator";
        statusIcon.innerHTML = `<svg class="w-16 h-16 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
        statusIcon.className = "w-32 h-32 rounded-full border-4 border-red-600 flex items-center justify-center bg-red-900/20 shadow-[0_0_30px_rgba(255,0,0,0.5)]";
    } else {
        const user = JSON.parse(match.label);
        subjectName.innerText = user.name;
        subjectRole.innerText = user.role;
        subjectId.innerText = `ID: ${user.id}`;
        accessStatus.innerText = "GRANTED";
        accessStatus.className = "text-4xl font-black uppercase tracking-widest text-green-500 status-indicator";
        statusIcon.innerHTML = `<svg class="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
        statusIcon.className = "w-32 h-32 rounded-full border-4 border-green-500 flex items-center justify-center bg-green-900/20 shadow-[0_0_30px_rgba(57,255,20,0.5)]";
        
        log("Access", `Access Granted: ${user.name}`);
    }
}

function resetUI() {
    // Optional: Reset to standby if no face detected for a while
}

function log(type, msg) {
    // Simple log throttle
    const now = Date.now();
    if (now - lastLogTime < 2000) return; // Prevent log spam
    lastLogTime = now;

    const div = document.createElement('div');
    div.className = "flex justify-between text-gray-400";
    div.innerHTML = `<span>[${new Date().toLocaleTimeString()}]</span> <span>${msg}</span>`;
    accessLogs.prepend(div);
}