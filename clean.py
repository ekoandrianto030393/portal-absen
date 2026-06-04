import sys

file_path = "c:\\Users\\hi\\Desktop\\biometrik\\scan.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Define the new verificationCardHTML
new_html_def = """            // [NEW] Unified Verification Card HTML Block
            const verificationCardHTML = `
                <div class="verification-certificate" style="width: 1000px; height: 500px; background: linear-gradient(135deg, #022c22 0%, #064e3b 50%, #022c22 100%); border: 3px solid #FFD700; border-radius: 16px; box-shadow: 0 40px 80px rgba(0,0,0,0.9), inset 0 0 40px rgba(255,215,0,0.15); display: flex; overflow: hidden; transform-style: preserve-3d; animation: certEntry 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.2s; opacity: 0; position: relative;">
                    <style>
                        @keyframes certEntry {
                            0% { opacity: 0; transform: translateY(-50px) scale(0.95); filter: blur(10px); }
                            100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
                        }
                    </style>
                    <!-- Glare Effect -->
                    <div class="absolute inset-0 z-0 pointer-events-none" style="background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%); background-size: 300% 100%; animation: card-glare 5s linear infinite;"></div>

                    <!-- Left Panel: Large Photo & Identity (45% Width) -->
                    <div style="width: 45%; background: linear-gradient(to bottom, #000000, #0a0a0a); position: relative; border-right: 3px solid #FFD700; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10;">
                        <!-- Tech pattern overlay -->
                        <div class="absolute inset-0 opacity-10" style="background-image: repeating-linear-gradient(45deg, #FFD700 0, #FFD700 1px, transparent 0, transparent 5px); background-size: 10px 10px;"></div>
                        
                        <!-- Photo Frame -->
                        <div style="width: 300px; height: 400px; border: 4px solid #FFD700; border-radius: 12px; overflow: hidden; position: relative; box-shadow: 0 15px 40px rgba(255,215,0,0.3); background: #000;">
                            <img src="${employeeData.foto ? `data:image/jpeg;base64,${employeeData.foto}` : ''}" style="width: 100%; height: 100%; object-fit: cover; filter: contrast(1.1) saturate(1.1);" onerror="this.style.display='none'">
                            <!-- Inner shadow for depth -->
                            <div class="absolute inset-0" style="box-shadow: inset 0 0 20px rgba(0,0,0,0.8);"></div>
                        </div>

                        <!-- Verification Ribbon -->
                        <div style="position: absolute; bottom: 20px; z-index: 20; background: ${finalStatusColor}; padding: 10px 40px; border-radius: 30px; border: 2px solid #FFF; box-shadow: 0 5px 15px rgba(0,0,0,0.8);">
                            <span style="color: #FFF; font-size: 18px; font-weight: 900; letter-spacing: 4px; font-family: 'Playfair Display', serif; text-transform: uppercase;">${result.success ? 'TERVERIFIKASI' : 'DITOLAK'}</span>
                        </div>
                    </div>

                    <!-- Right Panel: Verification Details & Academic Stamp (55% Width) -->
                    <div style="width: 55%; padding: 40px 50px; position: relative; display: flex; flex-direction: column; justify-content: space-between; z-index: 10;">
                        <!-- Watermark Logo -->
                        <div class="absolute inset-0 opacity-5" style="background-image: url('logo.jpg'); background-size: 60%; background-position: center; background-repeat: no-repeat; filter: grayscale(100%) contrast(200%); pointer-events: none;"></div>
                        
                        <!-- Header -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid rgba(255,215,0,0.4); padding-bottom: 20px; z-index: 2;">
                            <div>
                                <h1 style="color: #FFD700; font-size: 26px; margin: 0; letter-spacing: 5px; font-family: 'Times New Roman', serif; text-shadow: 1px 1px 3px #000;">LEMBAR VERIFIKASI</h1>
                                <p style="color: #FFF; font-size: 16px; margin: 5px 0 0; letter-spacing: 2px; font-family: 'Montserrat', sans-serif;">UPTD PUSKESMAS WANA</p>
                            </div>
                            <img src="logo.jpg" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #FFD700; box-shadow: 0 0 20px rgba(255,215,0,0.5);" onerror="this.style.display='none'">
                        </div>

                        <!-- Identity Info -->
                        <div style="margin-top: 25px; position: relative; z-index: 2;">
                            <h2 style="color: #FFF; font-size: 42px; font-weight: 900; font-family: 'Playfair Display', serif; margin: 0; text-shadow: 2px 2px 5px #000; line-height: 1.1;">${display_name}</h2>
                            <p style="color: #FFD700; font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 10px 0; text-transform: uppercase;">${display_jabatan}</p>
                            <div style="display: inline-block; border-left: 4px solid #FFD700; padding-left: 15px; margin-top: 5px;">
                                <span style="color: #ccc; font-size: 14px; letter-spacing: 2px; display: block; margin-bottom: 3px;">ID PEGAWAI</span>
                                <span style="color: #FFF; font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 3px;">${karyawanId}</span>
                            </div>
                        </div>

                        <!-- Status & Message -->
                        <div style="margin-top: 20px; padding: 25px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,215,0,0.3); border-radius: 8px; border-left: 6px solid ${finalStatusColor}; z-index: 2; box-shadow: 0 10px 20px rgba(0,0,0,0.5);">
                            <div style="font-size: 28px; font-weight: 900; font-family: 'Playfair Display', serif; color: ${finalStatusColor}; text-shadow: 0 0 10px ${finalStatusColor}66, 2px 2px 4px #000; letter-spacing: 3px; text-transform: uppercase;">
                                ${finalStatusText}
                            </div>
                            <div style="color: #FFF; font-size: 18px; margin-top: 10px; font-weight: 500; letter-spacing: 1px; line-height: 1.4;">
                                ${finalMessageHTML}
                            </div>
                        </div>

                        <!-- Details Footer -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 20px; z-index: 2;">
                            <div style="font-family: 'Courier New', monospace; font-size: 14px;">
                                <div style="color: rgba(255,255,255,0.6); margin-bottom: 5px;">WAKTU VERIFIKASI</div>
                                <div style="color: #FFD700; font-weight: bold;">${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} | ${serverTimestamp}</div>
                            </div>
                            <!-- Small Seal / QR placeholder -->
                            <div style="width: 60px; height: 60px; border: 2px solid ${finalStatusColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 10px ${finalStatusColor}88;">
                                <div style="width: 40px; height: 40px; border: 1px dashed ${finalStatusColor}; border-radius: 50%; animation: spin-slow 10s linear infinite;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;"""

import re

# Replace idCardHTML definition
pattern1 = re.compile(r"// \[NEW\] ID Card HTML Block.*?</div>\n\s*`;", re.DOTALL)
if pattern1.search(content):
    content = pattern1.sub(new_html_def, content)
else:
    print("Could not find idCardHTML definition")

# Define the new injection container
new_injection = """                <div class="holographic-container" style="perspective: 2000px; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; position: relative; z-index: 10;">
                <div class="render-line"></div>
                <div style="display: flex; justify-content: center; align-items: center; width: 100%; transform-style: preserve-3d;">
                    <!-- Single Large Verification Profile Certificate -->
                    <div style="transform: translateZ(20px); position: relative;">
                        <!-- Certificate Drop Shadow -->
                        <div style="position: absolute; inset: 10px; background: rgba(0,0,0,0.8); filter: blur(30px); z-index: -1; border-radius: 16px; animation: certEntry 1s ease-out forwards 0.2s; opacity: 0;"></div>
                        ${verificationCardHTML}
                    </div>
                </div>
                </div>"""

# Replace the holographic-container injection
pattern2 = re.compile(r'<div class="holographic-container" style="perspective: 2000px; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; position: relative; z-index: 10;">.*?</div>\n\s*</div>\n\s*</div>', re.DOTALL)

if pattern2.search(content):
    content = pattern2.sub(new_injection, content)
else:
    print("Could not find holographic-container definition")

# Also we need to fix the mouse move logic that targets the old classes
# Target: const container = successOverlay.querySelector('.holographic-container > div');
# let's find the mousemove and update it
old_mouse_move = """            // [NEW] Parallax Mouse Move Effect
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
            }"""

new_mouse_move = """            // [NEW] Parallax Mouse Move Effect for Unified Certificate
            const container = successOverlay.querySelector('.holographic-container > div');
            const cert = successOverlay.querySelector('.verification-certificate');
            if (container && cert) {
                successOverlay.onmousemove = (e) => {
                    const rect = container.getBoundingClientRect();
                    const x = e.clientX - rect.left - rect.width / 2;
                    const y = e.clientY - rect.top - rect.height / 2;
                    const rotateY = -x / 60; // Slightly less sensitive for a larger card
                    const rotateX = y / 60;
                    container.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
                    
                    // Simple parallax on the inner card
                    cert.style.transform = `translateZ(30px) rotateY(${rotateY * 0.2}deg) rotateX(${rotateX * 0.2}deg)`;
                };
            }"""

content = content.replace(old_mouse_move, new_mouse_move)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
