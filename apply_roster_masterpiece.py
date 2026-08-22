import os

old_block = """            item.innerHTML = `
                ${radarPingHTML}

                <!-- Left Accent Neon Bar -->
                <div class="absolute left-0 top-0 bottom-0 w-[4px] z-20 rounded-r-full" style="background: linear-gradient(to bottom, ${glowColor}, ${glowColor}80); box-shadow: 0 0 10px ${glowColor}, 0 0 20px ${glowColor}60;"></div>

                <!-- Aurora Shimmer Sweep -->
                <div class="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none z-20" style="background: linear-gradient(105deg, transparent 20%, ${glowColor}10 50%, transparent 80%); transition: opacity 0.6s ease;"></div>

                <!-- AVATAR & TELEMETRY -->
                <div class="relative flex items-center justify-center flex-shrink-0 z-10 ml-3 transition-transform duration-500 group-hover:scale-105">
                    
                    <!-- Telemetry Equalizer Bars -->
                    <div class="absolute -left-3 top-1/2 -translate-y-1/2 flex items-end gap-[2px] h-[30px] w-[8px]">
                        <div class="w-[2px] rounded-t-sm" style="background: ${glowColor}; animation: telemetryBar 1.2s infinite ease-in-out; animation-delay: 0.1s;"></div>
                        <div class="w-[2px] rounded-t-sm" style="background: ${glowColor}; animation: telemetryBar 1.5s infinite ease-in-out; animation-delay: 0.3s;"></div>
                        <div class="w-[2px] rounded-t-sm" style="background: ${glowColor}; animation: telemetryBar 0.9s infinite ease-in-out; animation-delay: 0.5s;"></div>
                    </div>

                    <div class="relative w-[65px] h-[65px]">
                        <!-- Neon Glow Frame -->
                        <div class="absolute -inset-[2px] rounded-xl z-0" style="background: linear-gradient(135deg, ${glowColor}90, ${glowColor}40, ${glowColor}80); box-shadow: 0 0 15px ${glowColor}50;"></div>

                        <!-- Inner bezel -->
                        <div class="absolute inset-[1.5px] rounded-[10px] z-0" style="background: rgba(1,6,4,0.9);"></div>

                        <!-- Photo -->
                        <img src="${photoSrc}" class="w-full h-full rounded-[10px] object-cover relative z-10" style="filter: brightness(1.1) contrast(1.1); image-rendering: high-quality;">

                        <!-- Status Dot -->
                        <div class="absolute -bottom-2 -right-2 w-[22px] h-[22px] rounded-full border-[2.5px] z-40 flex items-center justify-center" style="background: ${glowColor}; border-color: rgba(1,6,4,1); box-shadow: 0 0 10px ${glowColor}, 0 0 20px ${glowColor}80;" title="${statusText}">
                            <span class="absolute -inset-[2px] rounded-full animate-[pulse_2s_ease-in-out_infinite] z-0" style="background: ${glowColor}; opacity: 0.6;"></span>
                        </div>
                    </div>
                </div>

                <!-- INFO SECTION -->
                <div class="flex-grow min-w-0 z-10 ml-5">
                    <div class="flex items-center justify-between mb-0.5">
                        <p class="font-black text-[15px] text-white truncate leading-tight tracking-wide transition-colors duration-300" style="text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${row.nama}</p>
                        ${dlIcon || cutiIcon || ''}
                    </div>
                    <p class="text-[11px] font-bold truncate mb-2 uppercase tracking-widest text-white/80" style="text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${row.jabatan || '-'}</p>

                    <!-- Data Grid -->
                    <div class="grid grid-cols-2 gap-2 p-2 rounded-lg" style="background: rgba(0,0,0,0.6); border: 1px solid ${glowColor}40; box-shadow: inset 0 2px 8px rgba(0,0,0,0.8);">
                        <!-- Timestamp -->
                        <div class="flex flex-col justify-center">
                            <span class="text-[8px] uppercase font-black tracking-[0.25em] mb-1 flex items-center gap-1" style="color: rgba(255,255,255,0.6);">
                                <i class="fa-solid fa-clock" style="color: ${glowColor}; text-shadow: 0 0 5px ${glowColor};"></i> WAKTU
                            </span>
                            <p class="text-[13px] font-mono font-black tracking-widest leading-none" style="background: linear-gradient(90deg, #ffffff, ${glowColor}); -webkit-background-clip: text; color: transparent; filter: drop-shadow(0 2px 4px rgba(0,0,0,1));">${timeDisplay}</p>
                        </div>
                        <!-- Status Badge -->
                        <div class="flex flex-col justify-center items-end">
                            <span class="text-[8px] uppercase font-black tracking-[0.25em] mb-1 flex items-center gap-1" style="color: rgba(255,255,255,0.6);">
                                <i class="fa-solid fa-shield-halved" style="color: ${glowColor}; text-shadow: 0 0 5px ${glowColor};"></i> STATUS
                            </span>
                            <span class="text-[10px] px-2.5 py-0.5 rounded border font-black tracking-[0.15em] uppercase text-white" style="background: linear-gradient(135deg, ${glowColor}90, ${glowColor}40); border-color: ${glowColor}; text-shadow: 0 1px 3px rgba(0,0,0,0.9); box-shadow: 0 0 10px ${glowColor}40;">${statusText === 'SUDAH PULANG' ? 'PULANG' : statusText}</span>
                        </div>
                    </div>
                </div>
            `;"""

new_block = """            // Pola motif geometris mewah (Holographic Hex)
            const motifBg = `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0l20 10v20L20 40 0 30V10z' fill-rule='evenodd' stroke='%23ffffff' stroke-width='0.5' stroke-opacity='0.08' fill='none'/%3E%3C/svg%3E")`;

            item.style.cssText = `
                background: ${cardBg}, ${motifBg};
                background-blend-mode: overlay;
                background-size: cover, 40px 40px;
                border-color: rgba(255,255,255,0.1);
                box-shadow: 0 10px 30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 0 20px ${glowColor}20;
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                transform-style: preserve-3d;
            `;

            if (isCuti) {
                item.style.borderStyle = 'dashed';
                item.style.borderWidth = '1px';
            }

            const radarPingHTML = isDL ? `<div class="absolute inset-0 rounded-xl" style="border: 2px solid ${glowColor}; animation: radarPing 3s infinite ease-out; pointer-events:none;"></div>` : '';

            item.innerHTML = `
                ${radarPingHTML}

                <!-- Ultra Premium Left Accent Glow -->
                <div class="absolute left-0 top-0 bottom-0 w-[5px] z-20 rounded-l-xl" style="background: linear-gradient(to bottom, #ffffff, ${glowColor}, #ffffff); box-shadow: 0 0 15px ${glowColor}, 0 0 30px ${glowColor}80;"></div>

                <!-- Glass Shimmer Sweep on Hover -->
                <div class="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none z-20" style="background: linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.1) 50%, transparent 80%); transition: opacity 0.4s ease; transform: translateZ(10px);"></div>

                <!-- AVATAR & TELEMETRY -->
                <div class="relative flex items-center justify-center flex-shrink-0 z-10 ml-3 transition-transform duration-500 group-hover:scale-110" style="transform: translateZ(20px);">
                    
                    <!-- Tech Ring Backglow -->
                    <div class="absolute inset-[-10px] rounded-full opacity-50" style="background: radial-gradient(circle, ${glowColor}60 0%, transparent 70%);"></div>

                    <!-- Telemetry Equalizer Bars -->
                    <div class="absolute -left-3 top-1/2 -translate-y-1/2 flex items-end gap-[2px] h-[35px] w-[10px]">
                        <div class="w-[2px] rounded-t-sm" style="background: ${glowColor}; animation: telemetryBar 1.2s infinite ease-in-out; animation-delay: 0.1s; box-shadow: 0 0 5px ${glowColor};"></div>
                        <div class="w-[2px] rounded-t-sm" style="background: ${glowColor}; animation: telemetryBar 1.5s infinite ease-in-out; animation-delay: 0.3s; box-shadow: 0 0 5px ${glowColor};"></div>
                        <div class="w-[2px] rounded-t-sm" style="background: ${glowColor}; animation: telemetryBar 0.9s infinite ease-in-out; animation-delay: 0.5s; box-shadow: 0 0 5px ${glowColor};"></div>
                    </div>

                    <div class="relative w-[70px] h-[70px] rounded-[14px] p-[2px]" style="background: linear-gradient(135deg, rgba(255,255,255,0.6) 0%, ${glowColor} 50%, rgba(0,0,0,0.8) 100%); box-shadow: 0 10px 20px rgba(0,0,0,0.6), 0 0 15px ${glowColor}40;">
                        <!-- Inner bezel -->
                        <div class="w-full h-full rounded-[12px] bg-black relative overflow-hidden">
                            <!-- Photo -->
                            <img src="${photoSrc}" class="w-full h-full object-cover relative z-10 transition-transform duration-700 group-hover:scale-110" style="filter: brightness(1.15) contrast(1.1) saturate(1.2);">
                            <!-- Glass overlay on photo -->
                            <div class="absolute inset-0 z-20 pointer-events-none" style="background: linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, transparent 40%, rgba(0,0,0,0.4) 100%);"></div>
                        </div>

                        <!-- Advanced Status Dot -->
                        <div class="absolute -bottom-1 -right-1 w-[24px] h-[24px] rounded-full border-2 z-40 flex items-center justify-center overflow-hidden" style="background: ${glowColor}; border-color: #000; box-shadow: 0 0 15px ${glowColor}, inset 0 2px 4px rgba(255,255,255,0.5);" title="${statusText}">
                            <div class="absolute top-0 left-0 w-full h-1/2 bg-white/40 rounded-t-full"></div>
                            <span class="absolute -inset-[2px] rounded-full animate-[pulse_1.5s_ease-in-out_infinite] z-0" style="background: ${glowColor}; opacity: 0.8;"></span>
                        </div>
                    </div>
                </div>

                <!-- INFO SECTION -->
                <div class="flex-grow min-w-0 z-10 ml-5" style="transform: translateZ(15px);">
                    <div class="flex items-center justify-between mb-1">
                        <p class="font-black text-[16px] truncate leading-tight tracking-wider" style="background: linear-gradient(to right, #ffffff, #e2e8f0); -webkit-background-clip: text; color: transparent; text-shadow: 0 4px 10px rgba(0,0,0,0.8); filter: drop-shadow(0 0 2px rgba(255,255,255,0.2));">${row.nama}</p>
                        ${dlIcon || cutiIcon || ''}
                    </div>
                    <p class="text-[10px] font-extrabold truncate mb-2.5 uppercase tracking-[0.25em]" style="color: ${glowColor}; text-shadow: 0 2px 4px rgba(0,0,0,0.9);">${row.jabatan || '-'}</p>

                    <!-- Advanced Data Grid -->
                    <div class="flex gap-2">
                        <!-- Timestamp Pill -->
                        <div class="flex-1 flex flex-col justify-center px-3 py-1.5 rounded-lg relative overflow-hidden" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 6px rgba(0,0,0,0.4);">
                            <div class="absolute inset-0 opacity-20 pointer-events-none" style="background: linear-gradient(135deg, transparent, ${glowColor});"></div>
                            <span class="text-[7px] uppercase font-black tracking-[0.3em] flex items-center gap-1.5 mb-0.5 text-white/50 relative z-10">
                                <i class="fa-solid fa-clock" style="color: ${glowColor}; filter: drop-shadow(0 0 3px ${glowColor});"></i> WAKTU
                            </span>
                            <p class="text-[13px] font-mono font-black tracking-widest leading-none relative z-10 text-white" style="text-shadow: 0 2px 5px rgba(0,0,0,0.9), 0 0 10px ${glowColor}60;">${timeDisplay}</p>
                        </div>
                        
                        <!-- Status Badge Pill -->
                        <div class="flex-1 flex flex-col justify-center items-end px-3 py-1.5 rounded-lg relative overflow-hidden" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 6px rgba(0,0,0,0.4);">
                            <div class="absolute inset-0 opacity-20 pointer-events-none" style="background: linear-gradient(225deg, transparent, ${glowColor});"></div>
                            <span class="text-[7px] uppercase font-black tracking-[0.3em] flex items-center gap-1.5 mb-0.5 text-white/50 relative z-10">
                                STATUS <i class="fa-solid fa-shield-halved" style="color: ${glowColor}; filter: drop-shadow(0 0 3px ${glowColor});"></i>
                            </span>
                            <span class="text-[10px] px-2 py-0.5 rounded font-black tracking-[0.2em] uppercase text-white relative z-10" style="background: linear-gradient(135deg, ${glowColor}dd, ${glowColor}80); border: 1px solid ${glowColor}; text-shadow: 0 1px 2px rgba(0,0,0,0.8); box-shadow: 0 0 15px ${glowColor}50, inset 0 1px 0 rgba(255,255,255,0.4);">${statusText === 'SUDAH PULANG' ? 'PULANG' : statusText}</span>
                        </div>
                    </div>
                </div>
            `;"""

with open('scan.js', 'r', encoding='utf-8') as f:
    text = f.read()

# First we need to isolate the old block.
# Wait, the old motif code might already be there from my previous edit!
# Let me replace starting from "const motifBg" down to the end of item.innerHTML
# Let's write a regex or string replacement that captures from "const motifBg" to "</div>\n            `;"

import re
pattern = re.compile(r'            // Pola motif geometris mewah \(Holographic Hex\).*?</div>\n            `;', re.DOTALL)
if pattern.search(text):
    text = pattern.sub(new_block.strip(), text)
    with open('scan.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully upgraded roster cards!")
else:
    print("Could not find the block. Let's try the old one.")
    if old_block in text:
        text = text.replace(old_block, new_block)
        with open('scan.js', 'w', encoding='utf-8') as f:
            f.write(text)
        print("Successfully upgraded roster cards!")
    else:
        print("Failed to replace!")
