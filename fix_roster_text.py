import os

old_grid = """                    <!-- Advanced Data Grid -->
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
                    </div>"""

new_grid = """                    <!-- Advanced Data Grid -->
                    <div class="flex gap-2 w-full">
                        <!-- Timestamp Pill -->
                        <div class="flex-1 min-w-0 flex flex-col justify-center px-2 py-1.5 rounded-lg relative overflow-hidden" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 6px rgba(0,0,0,0.4);">
                            <div class="absolute inset-0 opacity-20 pointer-events-none" style="background: linear-gradient(135deg, transparent, ${glowColor});"></div>
                            <span class="text-[7px] uppercase font-black tracking-[0.2em] flex items-center gap-1 mb-0.5 text-white/50 relative z-10 truncate">
                                <i class="fa-solid fa-clock flex-shrink-0" style="color: ${glowColor}; filter: drop-shadow(0 0 3px ${glowColor});"></i> WAKTU
                            </span>
                            <p class="text-[11px] lg:text-[13px] font-mono font-black tracking-widest leading-none relative z-10 text-white truncate" style="text-shadow: 0 2px 5px rgba(0,0,0,0.9), 0 0 10px ${glowColor}60;">${timeDisplay}</p>
                        </div>
                        
                        <!-- Status Badge Pill -->
                        <div class="flex-1 min-w-0 flex flex-col justify-center items-start px-2 py-1.5 rounded-lg relative overflow-hidden" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 6px rgba(0,0,0,0.4);">
                            <div class="absolute inset-0 opacity-20 pointer-events-none" style="background: linear-gradient(225deg, transparent, ${glowColor});"></div>
                            <span class="text-[7px] uppercase font-black tracking-[0.2em] flex items-center gap-1 mb-0.5 text-white/50 relative z-10 truncate w-full">
                                <i class="fa-solid fa-shield-halved flex-shrink-0" style="color: ${glowColor}; filter: drop-shadow(0 0 3px ${glowColor});"></i> STATUS 
                            </span>
                            <span class="text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase text-white relative z-10 truncate max-w-full inline-block" style="background: linear-gradient(135deg, ${glowColor}dd, ${glowColor}80); border: 1px solid ${glowColor}; text-shadow: 0 1px 2px rgba(0,0,0,0.8); box-shadow: 0 0 15px ${glowColor}50, inset 0 1px 0 rgba(255,255,255,0.4);">${statusText === 'SUDAH PULANG' ? 'PULANG' : statusText}</span>
                        </div>
                    </div>"""

with open('scan.js', 'r', encoding='utf-8') as f:
    text = f.read()

if old_grid in text:
    text = text.replace(old_grid, new_grid)
    with open('scan.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully fixed text clipping.")
else:
    print("Could not find the old_grid string.")
