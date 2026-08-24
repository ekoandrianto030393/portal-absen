import os
import re

with open('scan.js', 'r', encoding='utf-8') as f:
    js_text = f.read()

# ========================================================
# 1. OPTIMIZATION: AUTO-DOWNSCALE VIDEO INPUT
# ========================================================
# Replace offscreenCanvas logic in detectFace
old_offscreen = r"""    if \(!video\.videoWidth\) return;
    offscreenCanvas\.width = video\.videoWidth;
    offscreenCanvas\.height = video\.videoHeight;"""

new_offscreen = """    if (!video.videoWidth) return;
    
    // [OPTIMIZATION 1: AUTO DOWNSCALE] Cap processing resolution to 640px max
    const scaleFactor = Math.min(1, 640 / video.videoWidth);
    offscreenCanvas.width = video.videoWidth * scaleFactor;
    offscreenCanvas.height = video.videoHeight * scaleFactor;"""

js_text = re.sub(old_offscreen, new_offscreen, js_text)

# We must also make sure `offCtx.drawImage(video, 0, 0);` scales.
old_draw = r"""    offCtx\.filter = 'brightness\(1\.1\) contrast\(1\.2\) saturate\(1\.0\) grayscale\(0\.2\)';
    offCtx\.drawImage\(video, 0, 0\);"""

new_draw = """    offCtx.filter = 'brightness(1.1) contrast(1.2) saturate(1.0) grayscale(0.2)';
    offCtx.drawImage(video, 0, 0, offscreenCanvas.width, offscreenCanvas.height);"""

js_text = re.sub(old_draw, new_draw, js_text)

# ========================================================
# 2. OPTIMIZATION: TAB VISIBILITY PAUSE
# ========================================================
old_detectFaceLoop = r"""async function detectFaceLoop\(\) \{"""

new_detectFaceLoop = """
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
"""

js_text = re.sub(old_detectFaceLoop, new_detectFaceLoop, js_text)

# ========================================================
# 3. OPTIMIZATION: GARBAGE COLLECTION
# ========================================================
old_init = r"""async function init\(\) \{"""

new_init = """// [OPTIMIZATION 3: MEMORY GARBAGE COLLECTOR]
// Clears unused WebGL Tensors every 30 minutes to prevent memory leaks in face-api.js
setInterval(() => {
    if (faceapi && faceapi.tf && faceapi.tf.engine) {
        console.log(`[GARBAGE COLLECTOR] Cleaning memory. Tensors before: ${faceapi.tf.memory().numTensors}`);
        // Dispose unused variables but keep loaded models
        faceapi.tf.disposeVariables(); 
        console.log(`[GARBAGE COLLECTOR] Done. Tensors after: ${faceapi.tf.memory().numTensors}`);
    }
}, 30 * 60 * 1000); // 30 minutes

async function init() {"""

js_text = re.sub(old_init, new_init, js_text)

with open('scan.js', 'w', encoding='utf-8') as f:
    f.write(js_text)

print("Optimizations applied successfully!")
