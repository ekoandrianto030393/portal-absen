import re

file_path = "c:\\Users\\hi\\Desktop\\biometrik\\scan.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

new_html_def = """            // [NEW] Unified Verification Card HTML Block (Glassmorphism + White Text)
            const verificationCardHTML = `
                <div class="verification-certificate" style="width: 1000px; height: 520px; background: rgba(0, 0, 0, 0.35); border: 2px solid ${finalStatusColor}; border-radius: 16px; box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 50px ${finalStatusColor}33, inset 0 0 30px ${finalStatusColor}22; display: flex; overflow: hidden; transform-style: preserve-3d; animation: certEntry 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.2s; opacity: 0; position: relative; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);">
                    <style>
                        @keyframes certEntry {
                            0% { opacity: 0; transform: translateY(-50px) scale(0.95) rotateX(10deg); filter: blur(10px); }
                            100% { opacity: 1; transform: translateY(0) scale(1) rotateX(0deg); filter: blur(0); }
                        }
                    </style>
                    <!-- Tech Pattern Overlay -->
                    <div class="absolute inset-0 z-0 pointer-events-none" style="background-image: repeating-linear-gradient(45deg, ${finalStatusColor} 0, ${finalStatusColor} 1px, transparent 0, transparent 10px); background-size: 20px 20px; opacity: 0.15;"></div>
                    <!-- Glare Effect -->
                    <div class="absolute inset-0 z-0 pointer-events-none" style="background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%); background-size: 300% 100%; animation: card-glare 5s linear infinite;"></div>

                    <!-- Left Panel: Large Photo & Identity (40% Width) -->
                    <div style="width: 40%; background: linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0.2)); position: relative; border-right: 2px solid ${finalStatusColor}88; padding: 40px 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10;">
                        
                        <!-- Photo Frame -->
                        <div style="width: 280px; height: 380px; border: 3px solid ${finalStatusColor}; border-radius: 12px; overflow: hidden; position: relative; box-shadow: 0 15px 40px rgba(0,0,0,0.6), 0 0 25px ${finalStatusColor}66; background: rgba(0,0,0,0.5);">
                            <img src="${employeeData.foto ? `data:image/jpeg;base64,${employeeData.foto}` : ''}" style="width: 100%; height: 100%; object-fit: cover; filter: contrast(1.1) saturate(1.1);" onerror="this.style.display='none'">
                            <!-- Grid Overlay on Photo -->
                            <div class="absolute inset-0 pointer-events-none" style="background-image: linear-gradient(${finalStatusColor}55 1px, transparent 1px), linear-gradient(90deg, ${finalStatusColor}55 1px, transparent 1px); background-size: 20px 20px; opacity: 0.3;"></div>
                            <!-- Inner shadow for depth -->
                            <div class="absolute inset-0 pointer-events-none" style="box-shadow: inset 0 0 30px rgba(0,0,0,0.7);"></div>
                        </div>

                        <!-- Verification Ribbon -->
                        <div style="position: absolute; bottom: 25px; z-index: 20; background: linear-gradient(90deg, rgba(0,0,0,0.8), rgba(20,20,20,0.8)); padding: 12px 30px; border-radius: 4px; border-left: 4px solid ${finalStatusColor}; border-right: 4px solid ${finalStatusColor}; box-shadow: 0 10px 25px rgba(0,0,0,0.6), 0 0 20px ${finalStatusColor}88; backdrop-filter: blur(5px);">
                            <span style="color: #FFFFFF; font-size: 18px; font-weight: 900; letter-spacing: 6px; font-family: 'Share Tech Mono', monospace, sans-serif; text-transform: uppercase; text-shadow: 2px 2px 4px #000, 0 0 10px ${finalStatusColor};">${result.success ? 'AKSES_DIIZINKAN' : 'AKSES_DITOLAK'}</span>
                        </div>
                    </div>

                    <!-- Right Panel: Verification Details (60% Width) -->
                    <div style="width: 60%; padding: 45px 50px; position: relative; display: flex; flex-direction: column; justify-content: space-between; z-index: 10;">
                        
                        <!-- Header -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid ${finalStatusColor}88; padding-bottom: 20px; z-index: 2;">
                            <div>
                                <h1 style="color: #FFFFFF; font-size: 24px; margin: 0; letter-spacing: 5px; font-family: 'Rajdhani', sans-serif; font-weight: 900; text-shadow: 2px 2px 4px #000, 0 0 15px ${finalStatusColor};">PROTOKOL AUTENTIKASI DIGITAL</h1>
                                <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
                                    <div style="width: 30px; height: 3px; background: ${finalStatusColor}; box-shadow: 0 0 5px ${finalStatusColor};"></div>
                                    <p style="color: #FFFFFF; font-size: 14px; margin: 0; letter-spacing: 3px; font-family: 'Courier New', monospace; font-weight: bold; text-shadow: 2px 2px 4px #000;">SISTEM KEAMANAN TERPADU - PUSKESMAS WANA</p>
                                </div>
                            </div>
                            <div style="background: rgba(255,255,255,0.8); padding: 5px; border-radius: 50%; box-shadow: 0 0 20px rgba(0,0,0,0.5);">
                                <img src="logo.jpg" style="width: 75px; height: 75px; border-radius: 50%; border: 2px solid ${finalStatusColor}; box-shadow: 0 0 15px ${finalStatusColor}88;" onerror="this.style.display='none'">
                            </div>
                        </div>

                        <!-- Identity Info -->
                        <div style="margin-top: 25px; position: relative; z-index: 2;">
                            <h2 style="color: #FFFFFF; font-size: 42px; font-weight: 900; font-family: 'Playfair Display', serif, sans-serif; margin: 0; text-shadow: 3px 3px 6px #000, 0 0 20px rgba(0,0,0,0.8); line-height: 1.1;">${display_name}</h2>
                            <p style="color: #FFFFFF; font-size: 20px; font-weight: bold; letter-spacing: 3px; margin: 10px 0; text-transform: uppercase; font-family: 'Rajdhani', sans-serif; text-shadow: 2px 2px 5px #000, 0 0 10px ${finalStatusColor};">${display_jabatan}</p>
                            
                            <div style="display: inline-flex; align-items: center; gap: 15px; margin-top: 10px; background: rgba(0,0,0,0.5); padding: 8px 18px; border-radius: 6px; border: 1px solid ${finalStatusColor}AA; box-shadow: 2px 2px 10px rgba(0,0,0,0.5); backdrop-filter: blur(5px);">
                                <span style="color: #FFFFFF; font-size: 13px; letter-spacing: 2px; font-family: 'Courier New', monospace; font-weight: bold; text-shadow: 1px 1px 2px #000;">ID_ENTITAS:</span>
                                <span style="color: #FFFFFF; font-family: 'Share Tech Mono', monospace, sans-serif; font-size: 22px; letter-spacing: 4px; font-weight: bold; text-shadow: 2px 2px 4px #000, 0 0 10px ${finalStatusColor};">${karyawanId}</span>
                            </div>
                        </div>

                        <!-- Status & Message Container -->
                        <div style="margin-top: 25px; display: flex; align-items: center; background: rgba(0,0,0,0.5); border: 1px solid ${finalStatusColor}88; border-radius: 8px; overflow: hidden; box-shadow: inset 0 0 25px rgba(0,0,0,0.6), 0 10px 25px rgba(0,0,0,0.5); z-index: 2; backdrop-filter: blur(5px);">
                            <!-- Icon Side -->
                            <div style="background: ${finalStatusColor}55; padding: 25px; display: flex; align-items: center; justify-content: center; border-right: 1px solid ${finalStatusColor}88; box-shadow: inset -5px 0 15px rgba(0,0,0,0.5);">
                                <div style="color: #FFFFFF; filter: drop-shadow(0 0 5px ${finalStatusColor}); transform: scale(1.6);">
                                    ${statusIconSVG}
                                </div>
                            </div>
                            <!-- Message Side -->
                            <div style="padding: 20px 25px; flex: 1;">
                                <div style="font-size: 26px; font-weight: 900; font-family: 'Rajdhani', sans-serif; color: #FFFFFF; text-shadow: 2px 2px 5px #000, 0 0 15px ${finalStatusColor}; letter-spacing: 3px; text-transform: uppercase; line-height: 1.2;">
                                    ${finalStatusText}
                                </div>
                                <div style="color: #FFFFFF; font-size: 16px; margin-top: 8px; font-weight: bold; letter-spacing: 0.5px; line-height: 1.5; font-family: 'Montserrat', sans-serif; text-shadow: 2px 2px 4px #000;">
                                    ${finalMessageHTML}
                                </div>
                            </div>
                        </div>

                        <!-- Details Footer -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 20px; border-top: 1px solid ${finalStatusColor}88; z-index: 2;">
                            <div style="font-family: 'Share Tech Mono', monospace, sans-serif; font-size: 13px; color: #FFFFFF;">
                                <div style="margin-bottom: 6px; letter-spacing: 2px; font-weight: bold; text-shadow: 2px 2px 4px #000;">TIMESTAMP_VERIFIKASI</div>
                                <div style="color: #FFFFFF; font-weight: bold; font-size: 18px; letter-spacing: 1px; text-shadow: 2px 2px 4px #000, 0 0 10px ${finalStatusColor};">
                                    ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} // ${serverTimestamp}
                                </div>
                                <div style="margin-top: 6px; font-size: 11px; opacity: 1; letter-spacing: 1px; font-weight: bold; text-shadow: 2px 2px 4px #000;">ENC_HASH: <span id="validation-hash-cert" style="color: #FFF;">GENERATING...</span></div>
                            </div>
                            <!-- Digital Hologram Stamp -->
                            <div style="position: relative; width: 70px; height: 70px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); border-radius: 50%; box-shadow: 0 0 15px rgba(0,0,0,0.5); backdrop-filter: blur(5px);">
                                <div style="position: absolute; inset: 0; border: 2px dashed ${finalStatusColor}; border-radius: 50%; animation: spin-slow 15s linear infinite; opacity: 1;"></div>
                                <div style="position: absolute; inset: 8px; border: 2px solid ${finalStatusColor}; border-radius: 50%; animation: spin-slow 10s linear infinite reverse; opacity: 0.8;"></div>
                                <div style="color: #FFFFFF; font-size: 24px; filter: drop-shadow(0 0 5px ${finalStatusColor});">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;"""

pattern1 = re.compile(r"// \[NEW\] Unified Verification Card HTML Block \([^)]+\).*?</div>\n\s*`;", re.DOTALL)
if pattern1.search(content):
    content = pattern1.sub(new_html_def, content)
else:
    print("Could not find verificationCardHTML definition")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done transparent")
