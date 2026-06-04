import re

file_path = "c:\\Users\\hi\\Desktop\\biometrik\\scan.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

new_html_def = """            // [NEW] Unified Verification Card HTML Block (Glassmorphism + White Text)
            const verificationCardHTML = `
                <div class="verification-certificate" style="width: 1000px; height: 520px; background: transparent; border: 2px solid ${finalStatusColor}; border-radius: 16px; box-shadow: 0 0 30px ${finalStatusColor}44, inset 0 0 30px ${finalStatusColor}44; display: flex; overflow: hidden; transform-style: preserve-3d; animation: certEntry 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.2s; opacity: 0; position: relative;">
                    <style>
                        @keyframes certEntry {
                            0% { opacity: 0; transform: translateY(-50px) scale(0.95) rotateX(10deg); filter: blur(10px); }
                            100% { opacity: 1; transform: translateY(0) scale(1) rotateX(0deg); filter: blur(0); }
                        }
                    </style>

                    <!-- Left Panel: Large Photo & Identity (40% Width) -->
                    <div style="width: 40%; background: transparent; position: relative; border-right: 2px solid ${finalStatusColor}; padding: 40px 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10;">
                        
                        <!-- Photo Frame -->
                        <div style="width: 280px; height: 380px; border: 3px solid ${finalStatusColor}; border-radius: 12px; overflow: hidden; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 25px ${finalStatusColor}88; background: transparent;">
                            <img src="${employeeData.foto ? `data:image/jpeg;base64,${employeeData.foto}` : ''}" style="width: 100%; height: 100%; object-fit: cover; filter: contrast(1.1) saturate(1.1);" onerror="this.style.display='none'">
                        </div>

                        <!-- Verification Ribbon -->
                        <div style="position: absolute; bottom: 25px; z-index: 20; background: #000; padding: 12px 30px; border-radius: 4px; border: 2px solid ${finalStatusColor}; box-shadow: 0 10px 25px rgba(0,0,0,0.9), 0 0 20px ${finalStatusColor};">
                            <span style="color: #FFFFFF; font-size: 18px; font-weight: 900; letter-spacing: 6px; font-family: 'Share Tech Mono', monospace, sans-serif; text-transform: uppercase; text-shadow: 2px 2px 4px #000, 0 0 10px ${finalStatusColor};">${result.success ? 'AKSES_DIIZINKAN' : 'AKSES_DITOLAK'}</span>
                        </div>
                    </div>

                    <!-- Right Panel: Verification Details (60% Width) -->
                    <div style="width: 60%; padding: 45px 50px; background: transparent; position: relative; display: flex; flex-direction: column; justify-content: space-between; z-index: 10;">
                        
                        <!-- Header -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid ${finalStatusColor}; padding-bottom: 20px; z-index: 2;">
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
                            
                            <div style="display: inline-flex; align-items: center; gap: 15px; margin-top: 10px; background: rgba(0,0,0,0.6); padding: 8px 18px; border-radius: 6px; border: 1px solid ${finalStatusColor}; box-shadow: 2px 2px 10px rgba(0,0,0,0.8);">
                                <span style="color: #FFFFFF; font-size: 13px; letter-spacing: 2px; font-family: 'Courier New', monospace; font-weight: bold; text-shadow: 1px 1px 2px #000;">ID_ENTITAS:</span>
                                <span style="color: #FFFFFF; font-family: 'Share Tech Mono', monospace, sans-serif; font-size: 22px; letter-spacing: 4px; font-weight: bold; text-shadow: 2px 2px 4px #000, 0 0 10px ${finalStatusColor};">${karyawanId}</span>
                            </div>
                        </div>

                        <!-- Status & Message Container -->
                        <div style="margin-top: 25px; display: flex; align-items: stretch; background: rgba(0,0,0,0.8); border: 2px solid ${finalStatusColor}; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.8), 0 0 15px ${finalStatusColor}66; z-index: 2;">
                            <!-- Icon Side -->
                            <div style="background: ${finalStatusColor}44; padding: 20px; display: flex; align-items: center; justify-content: center; border-right: 2px solid ${finalStatusColor};">
                                <div style="color: #FFFFFF; filter: drop-shadow(0 0 8px ${finalStatusColor}); transform: scale(1.5);">
                                    ${statusIconSVG}
                                </div>
                            </div>
                            <!-- Message Side -->
                            <div style="padding: 20px 25px; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                                <div style="font-size: 22px; font-weight: 900; font-family: 'Rajdhani', sans-serif; color: #FFFFFF; text-shadow: 2px 2px 5px #000, 0 0 15px ${finalStatusColor}; letter-spacing: 2px; text-transform: uppercase; line-height: 1.2; border-bottom: 1px dashed ${finalStatusColor}; padding-bottom: 8px; margin-bottom: 8px;">
                                    ${finalStatusText}
                                </div>
                                <div style="color: #FFFFFF; font-size: 16px; font-weight: bold; letter-spacing: 0.5px; line-height: 1.5; font-family: 'Montserrat', sans-serif; text-shadow: 2px 2px 4px #000;">
                                    ${finalMessageHTML}
                                </div>
                            </div>
                        </div>

                        <!-- Details Footer -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 20px; border-top: 2px solid ${finalStatusColor}; z-index: 2;">
                            <div style="font-family: 'Share Tech Mono', monospace, sans-serif; font-size: 13px; color: #FFFFFF;">
                                <div style="margin-bottom: 6px; letter-spacing: 2px; font-weight: bold; text-shadow: 2px 2px 4px #000;">TIMESTAMP_VERIFIKASI</div>
                                <div style="color: #FFFFFF; font-weight: bold; font-size: 18px; letter-spacing: 1px; text-shadow: 2px 2px 4px #000, 0 0 10px ${finalStatusColor};">
                                    ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} // ${serverTimestamp}
                                </div>
                                <div style="margin-top: 6px; font-size: 11px; opacity: 1; letter-spacing: 1px; font-weight: bold; text-shadow: 2px 2px 4px #000;">ENC_HASH: <span id="validation-hash-cert" style="color: #FFF;">GENERATING...</span></div>
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

print("Done final fix")
