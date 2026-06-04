import os

with open('scan.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Add Telemetry HUD to videoContainer
telemetry_html = '''
                    <!-- [NEW] Dynamic Telemetry HUD -->
                    <div class="absolute top-4 left-4 text-[9px] text-amber-300 font-mono leading-tight pointer-events-none opacity-80 z-20 drop-shadow-[0_0_2px_rgba(255,215,0,0.8)]">
                        <div class="animate-pulse mb-1">[+] AETHER_V5.0_UPLINK</div>
                        SEC_KEY: <span id="teleKey">0x000</span><br>
                        COORD_X: <span id="telePosX">---</span><br>
                        COORD_Y: <span id="telePosY">---</span><br>
                        NET_LAT: <span id="telePing">12ms</span>
                    </div>
                    <!-- [NEW] Radar Sweep -->
                    <div class="absolute inset-0 bg-gradient-to-b from-transparent via-amber-400/20 to-transparent h-[20%] animate-[radarSweep_3s_linear_infinite] pointer-events-none z-10"></div>
'''
if 'id="teleKey"' not in html:
    html = html.replace('<canvas id="overlay"', telemetry_html + '\n                    <canvas id="overlay"')

# Add radarSweep animation to CSS
css_radar = '''
    @keyframes radarSweep {
        0% { transform: translateY(-100%); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(500%); opacity: 0; }
    }
'''
if 'radarSweep' not in html:
    html = html.replace('</style>', css_radar + '</style>')

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Updated scan.html')

with open('scan.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Add JS functions
js_features = '''
// --- [NEW] SCI-FI SOUND EFFECTS (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSciFiSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'scan') {
        // High pitched short beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'success') {
        // Ascending chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } else if (type === 'ambient') {
        // Low drone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(50, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
        osc.start();
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
        osc.stop(audioCtx.currentTime + 2);
    }
}

// --- [NEW] UPDATE TELEMETRY DATA ---
setInterval(() => {
    const key = document.getElementById('teleKey');
    const posX = document.getElementById('telePosX');
    const posY = document.getElementById('telePosY');
    const ping = document.getElementById('telePing');
    if(key) key.textContent = '0x' + Math.floor(Math.random()*4095).toString(16).toUpperCase().padStart(3,'0');
    if(posX) posX.textContent = (Math.random()*100).toFixed(2);
    if(posY) posY.textContent = (Math.random()*100).toFixed(2);
    if(ping) ping.textContent = Math.floor(Math.random()*20 + 5) + 'ms';
    
    // Random ambient sound tick
    if(Math.random() < 0.05) playSciFiSound('ambient');
}, 150);

// --- [NEW] SUCCESS BURST ANIMATION ---
function triggerSuccessBurst() {
    playSciFiSound('success');
    const overlay = document.getElementById('successOverlay');
    if(overlay) {
        overlay.style.backgroundColor = 'rgba(255, 215, 0, 0.4)';
        overlay.style.boxShadow = 'inset 0 0 100px rgba(255, 215, 0, 0.8)';
        overlay.style.opacity = '1';
        setTimeout(() => {
            overlay.style.transition = 'opacity 1.5s ease-out';
            overlay.style.opacity = '0';
        }, 100);
    }
}
'''
if 'playSciFiSound' not in js:
    js = js + '\n' + js_features

if 'logAttendance(name, time)' in js and 'triggerSuccessBurst()' not in js:
    js = js.replace('function logAttendance(name, time) {', 'function logAttendance(name, time) {\n    triggerSuccessBurst();')

throttle_code = '''
    // Throttle scan sound
    if (!window.lastScanSound || Date.now() - window.lastScanSound > 1000) {
        playSciFiSound('scan');
        window.lastScanSound = Date.now();
    }
'''
if 'drawSmartHUD(ctx' in js and "playSciFiSound('scan')" not in js:
    js = js.replace("function drawSmartHUD(ctx, box, label, color, confidence, emotion = '-', gender = '-', age = '-') {", "function drawSmartHUD(ctx, box, label, color, confidence, emotion = '-', gender = '-', age = '-') {" + throttle_code)

with open('scan.js', 'w', encoding='utf-8') as f:
    f.write(js)
print('Updated scan.js')
