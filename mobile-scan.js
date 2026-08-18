// mobile-scan.js — Logika PWA Mobile Scan Dinas Luar
// Tema: Midnight Sapphire-Emerald  •  Full-Screen Camera App

// ═══════════ DOM ELEMENTS ═══════════
const video        = document.getElementById('video-feed');
const canvas       = document.getElementById('face-canvas');
const btnSubmit    = document.getElementById('btn-submit');
const locationText = document.getElementById('location-text');
const gpsStatus    = document.getElementById('gps-status');
const modelStatus  = document.getElementById('model-status');
const identityPanel = document.getElementById('identity-panel');
const detectedPhoto = document.getElementById('detected-photo');
const detectedIcon  = document.getElementById('detected-icon');
const detectedName  = document.getElementById('detected-name');
const detectedJob   = document.getElementById('detected-job');
const matchScore    = document.getElementById('match-score');

// ═══════════ STATE ═══════════
let labeledDescriptors = null;
let currentPosition    = null;
let currentMatch       = null;
let isScanning         = false;
let isModelLoaded      = false;

// ═══════════ 1 · LOAD AI MODELS ═══════════
async function loadModels() {
    try {
        const MODEL_URL = '/models';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        isModelLoaded = true;
        modelStatus.classList.remove('pill--warn', 'animate-pulse');
        modelStatus.classList.add('pill--ok');
        modelStatus.innerHTML = '<i class="fa-solid fa-check"></i><span>AI Siap</span>';
        // Sembunyikan setelah 2 detik
        setTimeout(() => { modelStatus.style.display = 'none'; }, 2000);

        await loadKaryawanData();
        startCamera();
    } catch (e) {
        console.error('Model load error:', e);
        modelStatus.classList.remove('pill--warn', 'animate-pulse');
        modelStatus.classList.add('pill--err');
        modelStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><span>AI Gagal</span>';
    }
}

// ═══════════ 2 · LOAD KARYAWAN ═══════════
async function loadKaryawanData() {
    try {
        const res  = await fetch('/api/karyawan/descriptors');
        const data = await res.json();
        if (data.success && data.descriptors) {
            labeledDescriptors = data.descriptors
                .map(k => {
                    if (!k.face_descriptor) return null;
                    return new faceapi.LabeledFaceDescriptors(
                        JSON.stringify({ id: k.id_karyawan, nama: k.nama, jabatan: k.jabatan, foto: k.foto }),
                        [new Float32Array(k.face_descriptor)]
                    );
                })
                .filter(Boolean);
            console.log(`✅ ${labeledDescriptors.length} wajah dimuat.`);
        }
    } catch (e) {
        console.error('Karyawan load error:', e);
    }
}

// ═══════════ 3 · CAMERA ═══════════
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } }
        });
        video.srcObject = stream;
    } catch (e) {
        console.error('Camera error:', e);
        Swal.fire({ title: 'Kamera Gagal', text: 'Izinkan akses kamera untuk absen.', icon: 'error',
            confirmButtonColor: '#38bdf8', background: '#0f172a', color: '#fff' });
    }
}

// ═══════════ 4 · GPS ═══════════
function startGPS() {
    if (!('geolocation' in navigator)) {
        gpsStatus.classList.remove('pill--warn');
        gpsStatus.classList.add('pill--err');
        gpsStatus.innerHTML = '<i class="fa-solid fa-ban"></i><span>GPS Tidak Didukung</span>';
        return;
    }
    navigator.geolocation.watchPosition(
        (pos) => {
            currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
            gpsStatus.classList.remove('pill--warn', 'animate-pulse');
            gpsStatus.classList.add('pill--ok');
            gpsStatus.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i><span>GPS Aktif</span>';
            locationText.innerHTML =
                `${currentPosition.lat.toFixed(6)}, ${currentPosition.lng.toFixed(6)}<br>` +
                `<span class="text-[10px] text-sky-400/70">Akurasi ±${Math.round(currentPosition.acc)}m</span>`;
            checkReadyState();
        },
        () => {
            gpsStatus.classList.remove('pill--warn', 'animate-pulse');
            gpsStatus.classList.add('pill--err');
            gpsStatus.innerHTML = '<i class="fa-solid fa-location-dot"></i><span>GPS Gagal</span>';
            locationText.innerHTML = '<span class="text-red-400 text-[12px]">Aktifkan Lokasi di HP Anda</span>';
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
}

// ═══════════ 5 · FACE DETECTION LOOP ═══════════
function startDetectionLoop() {
    if (!video) return;
    video.addEventListener('play', () => {
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        if (displaySize.width === 0 || displaySize.height === 0) return; // guard
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
            if (!isModelLoaded || !labeledDescriptors || isScanning) return;

            const det = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (det) {
                const rd  = faceapi.resizeResults(det, displaySize);
                const box = rd.detection.box;

                // ── Draw neon box ──
                ctx.save();
                ctx.strokeStyle = 'rgba(56,189,248,0.7)';
                ctx.lineWidth = 2;
                ctx.shadowColor = 'rgba(56,189,248,0.5)';
                ctx.shadowBlur = 10;
                ctx.strokeRect(box.x, box.y, box.width, box.height);
                ctx.restore();

                // ── Match ──
                const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.45);
                const match   = matcher.findBestMatch(det.descriptor);

                if (match.label !== 'unknown') {
                    const emp = JSON.parse(match.label);
                    currentMatch = emp;

                    identityPanel.classList.remove('opacity-0', 'translate-y-4');
                    detectedName.textContent = emp.nama;
                    detectedJob.textContent  = emp.jabatan;

                    if (emp.foto) {
                        detectedPhoto.src = `data:image/jpeg;base64,${emp.foto}`;
                        detectedPhoto.classList.remove('hidden');
                        detectedIcon.classList.add('hidden');
                    }

                    const pct = Math.round((1 - match.distance) * 100);
                    matchScore.textContent = `${pct}%`;
                    matchScore.classList.remove('hidden');

                    checkReadyState();
                } else {
                    resetIdentity();
                }
            } else {
                resetIdentity();
            }
        }, 250);
    });
}

function resetIdentity() {
    if (isScanning) return;
    currentMatch = null;
    identityPanel.classList.add('opacity-0', 'translate-y-4');
    updateButton(false);
}

function checkReadyState() {
    updateButton(!!(currentMatch && currentPosition));
}

function updateButton(ready) {
    if (ready) {
        btnSubmit.disabled = false;
        btnSubmit.className = 'btn-action btn-action--ready pulse-ring';
    } else {
        btnSubmit.disabled = true;
        btnSubmit.className = 'btn-action btn-action--disabled';
    }
}

// ═══════════ 6 · SUBMIT ═══════════
btnSubmit.addEventListener('click', async () => {
    if (!currentMatch || !currentPosition) return;

    isScanning = true;
    btnSubmit.disabled = true;
    btnSubmit.className = 'btn-action btn-action--disabled';
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xl"></i><span>MENGIRIM...</span>';

    try {
        const now  = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        const time  = now.toTimeString().split(' ')[0];

        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${currentPosition.lat},${currentPosition.lng}`;
        const ket    = `Mobile Scan DL (Acc:${Math.round(currentPosition.acc)}m) | Peta: ${mapUrl}`;

        const res = await fetch('/api/absensi/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_karyawan: currentMatch.id,
                status: 'DL',
                keterangan: ket,
                tanggal: today,
                jam_masuk: time,
                jam_keluar: ''
            })
        });

        const result = await res.json();

        if (result.success) {
            Swal.fire({
                title: '<span style="color:#34d399">BERHASIL</span>',
                html: `Absensi <b>Dinas Luar</b> tercatat.<br>Terima kasih, <b>${currentMatch.nama}</b>.`,
                icon: 'success',
                confirmButtonColor: '#34d399',
                background: '#0f172a',
                color: '#e2e8f0'
            });
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        Swal.fire({
            title: '<span style="color:#f87171">GAGAL</span>',
            text: e.message || 'Kesalahan jaringan.',
            icon: 'error',
            confirmButtonColor: '#f87171',
            background: '#0f172a',
            color: '#e2e8f0'
        });
    } finally {
        setTimeout(() => {
            isScanning = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-fingerprint text-xl"></i><span>ABSEN DINAS LUAR</span>';
            checkReadyState();
        }, 3000);
    }
});

// ═══════════ INIT ═══════════
window.addEventListener('DOMContentLoaded', () => {
    startDetectionLoop();
    loadModels();
    startGPS();
});
