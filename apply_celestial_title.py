import os

with open('scan.html', 'r', encoding='utf-8') as f:
    text = f.read()

# ===== ADD NEW ULTRA KEYFRAMES & STYLES =====
inject_after = "    /* ===== GOD-TIER TITLE SYSTEM ===== */"

new_css = """    /* ===== BEYOND GOD-TIER: CELESTIAL TITLE SYSTEM ===== */
    @keyframes sparkleFloat {
        0% { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 0; }
        20% { opacity: 1; transform: translate(var(--tx), var(--ty)) scale(1) rotate(90deg); }
        80% { opacity: 0.8; }
        100% { transform: translate(calc(var(--tx) * 2), calc(var(--ty) - 40px)) scale(0) rotate(360deg); opacity: 0; }
    }
    @keyframes holographicShift {
        0% { filter: hue-rotate(0deg) brightness(1.1); }
        25% { filter: hue-rotate(30deg) brightness(1.3); }
        50% { filter: hue-rotate(-20deg) brightness(1.2); }
        75% { filter: hue-rotate(15deg) brightness(1.4); }
        100% { filter: hue-rotate(0deg) brightness(1.1); }
    }
    @keyframes scanBeam {
        0% { left: -20%; opacity: 0; }
        5% { opacity: 1; }
        95% { opacity: 1; }
        100% { left: 120%; opacity: 0; }
    }
    @keyframes textGlitch {
        0%, 95%, 100% { transform: translate(0); }
        96% { transform: translate(-2px, 1px); }
        97% { transform: translate(2px, -1px); }
        98% { transform: translate(-1px, -1px); }
        99% { transform: translate(1px, 1px); }
    }
    @keyframes borderRotate {
        0% { background-position: 0% 50%; }
        100% { background-position: 300% 50%; }
    }
    @keyframes starTwinkle {
        0%, 100% { opacity: 0.2; transform: scale(0.5); }
        50% { opacity: 1; transform: scale(1.2); }
    }

    .celestial-frame {
        position: relative;
        padding: 15px 20px;
        border-radius: 16px;
        background: rgba(0,0,0,0.2);
        overflow: hidden;
    }
    .celestial-frame::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 16px;
        padding: 2px;
        background: linear-gradient(90deg, 
            #a78bfa, #38bdf8, #34d399, #fbbf24, #f472b6,
            #a78bfa, #38bdf8, #34d399, #fbbf24, #f472b6
        );
        background-size: 300% 100%;
        animation: borderRotate 6s linear infinite;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
        z-index: 1;
    }
    .celestial-frame::after {
        content: '';
        position: absolute;
        top: 0; left: -20%;
        width: 15%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
        animation: scanBeam 5s ease-in-out infinite;
        pointer-events: none;
        z-index: 2;
    }

    .sparkle-field {
        position: absolute;
        inset: -20px;
        pointer-events: none;
        z-index: 15;
        overflow: hidden;
    }
    .sparkle-field .sparkle {
        position: absolute;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: white;
        box-shadow: 0 0 6px 2px rgba(255,255,255,0.8), 0 0 12px 4px var(--spark-color, rgba(56,189,248,0.6));
        animation: starTwinkle var(--dur, 2s) ease-in-out infinite;
        animation-delay: var(--delay, 0s);
    }"""

text = text.replace(inject_after, new_css + "\n" + inject_after)

# ===== UPGRADE THE MAIN TITLE GRADIENT to even richer =====
old_gradient = """        background: linear-gradient(
            90deg,
            #a78bfa 0%,
            #38bdf8 10%,
            #ffffff 18%,
            #67e8f9 28%,
            #34d399 40%,
            #fbbf24 50%,
            #34d399 60%,
            #67e8f9 72%,
            #ffffff 82%,
            #38bdf8 90%,
            #a78bfa 100%
        );
        background-size: 400% auto;"""

new_gradient = """        background: linear-gradient(
            90deg,
            #c084fc 0%,
            #f472b6 8%,
            #fb923c 14%,
            #fbbf24 20%,
            #ffffff 28%,
            #34d399 36%,
            #22d3ee 44%,
            #ffffff 50%,
            #38bdf8 56%,
            #a78bfa 64%,
            #ffffff 72%,
            #fbbf24 80%,
            #fb923c 86%,
            #f472b6 92%,
            #c084fc 100%
        );
        background-size: 500% auto;"""

text = text.replace(old_gradient, new_gradient)

# ===== ADD holographic + glitch effect to main title =====
old_main_z = """        position: relative;
        z-index: 10;
    }

    .god-title-main::before {"""

new_main_z = """        position: relative;
        z-index: 10;
        animation: prismaticShine 6s linear infinite, holographicShift 10s ease-in-out infinite, textGlitch 8s ease infinite;
    }

    .god-title-main::before {"""

# careful - only replace in the .god-title-main context
text = text.replace(old_main_z, new_main_z, 1)

# Remove the old single animation line  
text = text.replace(
    "        animation: prismaticShine 6s linear infinite, holographicShift 10s ease-in-out infinite, textGlitch 8s ease infinite;\n        filter:",
    "        animation: prismaticShine 5s linear infinite, holographicShift 8s ease-in-out infinite, textGlitch 10s ease infinite;\n        filter:"
)

# ===== UPGRADE THE TITLE HTML to add celestial frame + sparkles =====
old_title_container = """                <div class="w-full text-center flex flex-col items-center justify-center pt-0 pb-0 mb-1 mt-1 lg:mt-2 relative god-title-container">
                    <!-- Multi-layer Corona Backglow -->
                    <div class="god-corona"></div>
                    <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[60%] h-[120%] rounded-full pointer-events-none z-0" style="background: radial-gradient(ellipse at center, rgba(59,130,246,0.12) 0%, transparent 70%); filter: blur(40px); animation: coronaBreath 7s ease-in-out infinite reverse;"></div>

                    <!-- Decorative Top Ornament -->
                    <div class="flex items-center w-full max-w-lg mb-2 relative z-10">
                        <div class="god-ornament-line" style="--dir: right;"></div>
                        <div class="god-diamond-separator">
                            <div class="diamond small"></div>
                            <div class="diamond"></div>
                            <div class="diamond small"></div>
                        </div>
                        <div class="god-ornament-line" style="--dir: left;"></div>
                    </div>

                    <!-- Main Title -->
                    <div class="flex flex-wrap items-center justify-center gap-2 lg:gap-3 mb-1 relative z-10">
                        <h1 id="mainTitle" class="god-title-main" data-text="PRESENSI BIOMETRIK">
                            PRESENSI<br>BIOMETRIK
                        </h1>
                    </div>
                    
                    <!-- Laser Divider + Subtitle -->
                    <div class="flex items-center justify-center w-full max-w-2xl mb-1 mt-1 relative z-10">
                        <div class="god-divider" style="--dir: right;"></div>
                        
                        <div class="god-diamond-separator">
                            <div class="diamond small"></div>
                        </div>

                        <h2 class="god-subtitle px-5">
                            PUSKESMAS WANA
                        </h2>

                        <div class="god-diamond-separator">
                            <div class="diamond small"></div>
                        </div>
                        
                        <div class="god-divider" style="--dir: left;"></div>
                    </div>
                    
                    <!-- Location with ornamental underline -->
                    <h3 class="god-location mb-1">
                        KABUPATEN LAMPUNG TIMUR
                    </h3>

                    <!-- Bottom Ornament -->
                    <div class="flex items-center w-full max-w-xs mt-1 mb-0 relative z-10">
                        <div class="god-ornament-line" style="--dir: right;"></div>
                        <div class="god-diamond-separator">
                            <div class="diamond small"></div>
                        </div>
                        <div class="god-ornament-line" style="--dir: left;"></div>
                    </div>
                </div>"""

new_title_container = """                <div class="w-full text-center flex flex-col items-center justify-center pt-0 pb-0 mb-1 mt-1 lg:mt-2 relative god-title-container">
                    <!-- Multi-layer Corona Backglow -->
                    <div class="god-corona"></div>
                    <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[60%] h-[120%] rounded-full pointer-events-none z-0" style="background: radial-gradient(ellipse at center, rgba(251,191,36,0.06) 0%, rgba(59,130,246,0.1) 25%, rgba(168,85,247,0.06) 50%, transparent 70%); filter: blur(40px); animation: coronaBreath 7s ease-in-out infinite reverse;"></div>

                    <!-- CELESTIAL FRAME with animated rainbow border -->
                    <div class="celestial-frame relative w-full max-w-2xl">
                        
                        <!-- Sparkle Field -->
                        <div class="sparkle-field">
                            <div class="sparkle" style="top:10%; left:5%; --spark-color:rgba(251,191,36,0.8); --dur:2.2s; --delay:0s;"></div>
                            <div class="sparkle" style="top:20%; left:90%; --spark-color:rgba(56,189,248,0.8); --dur:1.8s; --delay:0.4s;"></div>
                            <div class="sparkle" style="top:70%; left:15%; --spark-color:rgba(168,85,247,0.8); --dur:2.5s; --delay:0.8s;"></div>
                            <div class="sparkle" style="top:80%; left:85%; --spark-color:rgba(52,211,153,0.8); --dur:2s; --delay:1.2s;"></div>
                            <div class="sparkle" style="top:5%; left:50%; --spark-color:rgba(244,114,182,0.8); --dur:1.6s; --delay:0.2s;"></div>
                            <div class="sparkle" style="top:50%; left:3%; --spark-color:rgba(251,191,36,0.8); --dur:2.8s; --delay:1.5s;"></div>
                            <div class="sparkle" style="top:40%; left:95%; --spark-color:rgba(56,189,248,0.8); --dur:2.1s; --delay:0.6s;"></div>
                            <div class="sparkle" style="top:90%; left:40%; --spark-color:rgba(168,85,247,0.8); --dur:1.9s; --delay:1s;"></div>
                            <div class="sparkle" style="top:15%; left:70%; --spark-color:rgba(244,114,182,0.8); --dur:2.4s; --delay:1.8s;"></div>
                            <div class="sparkle" style="top:60%; left:60%; --spark-color:rgba(52,211,153,0.8); --dur:2.6s; --delay:0.3s;"></div>
                        </div>

                        <!-- Decorative Top Ornament -->
                        <div class="flex items-center w-full max-w-lg mx-auto mb-2 relative z-10">
                            <div class="god-ornament-line" style="--dir: right;"></div>
                            <div class="god-diamond-separator">
                                <div class="diamond small"></div>
                                <div class="diamond"></div>
                                <div class="diamond small"></div>
                            </div>
                            <div class="god-ornament-line" style="--dir: left;"></div>
                        </div>

                        <!-- Main Title -->
                        <div class="flex flex-wrap items-center justify-center gap-2 lg:gap-3 mb-1 relative z-10">
                            <h1 id="mainTitle" class="god-title-main" data-text="PRESENSI BIOMETRIK">
                                PRESENSI<br>BIOMETRIK
                            </h1>
                        </div>
                        
                        <!-- Laser Divider + Subtitle -->
                        <div class="flex items-center justify-center w-full max-w-xl mx-auto mb-1 mt-1 relative z-10">
                            <div class="god-divider" style="--dir: right;"></div>
                            
                            <div class="god-diamond-separator">
                                <div class="diamond small"></div>
                            </div>

                            <h2 class="god-subtitle px-4">
                                PUSKESMAS WANA
                            </h2>

                            <div class="god-diamond-separator">
                                <div class="diamond small"></div>
                            </div>
                            
                            <div class="god-divider" style="--dir: left;"></div>
                        </div>
                        
                        <!-- Location -->
                        <h3 class="god-location mb-1">
                            KABUPATEN LAMPUNG TIMUR
                        </h3>

                        <!-- Bottom Ornament -->
                        <div class="flex items-center w-full max-w-xs mx-auto mt-1 mb-0 relative z-10">
                            <div class="god-ornament-line" style="--dir: right;"></div>
                            <div class="god-diamond-separator">
                                <div class="diamond small"></div>
                            </div>
                            <div class="god-ornament-line" style="--dir: left;"></div>
                        </div>
                    </div>
                </div>"""

if old_title_container in text:
    text = text.replace(old_title_container, new_title_container)
    print("Title HTML upgraded with celestial frame + sparkles!")
else:
    print("WARNING: Could not find old title container HTML!")

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("=== CELESTIAL BEYOND-GOD-TIER TITLE APPLIED ===")
