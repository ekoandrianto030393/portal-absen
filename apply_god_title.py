import os

with open('scan.html', 'r', encoding='utf-8') as f:
    text = f.read()

# ===== STEP 1: Add ultra-premium CSS keyframes & styles =====
old_keyframe = """    @keyframes shine {
        0% { background-position: 200% center; }
        100% { background-position: -200% center; }
    }"""

new_keyframe = """    @keyframes shine {
        0% { background-position: 200% center; }
        100% { background-position: -200% center; }
    }

    /* ===== GOD-TIER TITLE SYSTEM ===== */
    @keyframes prismaticShine {
        0% { background-position: 300% center; }
        100% { background-position: -300% center; }
    }
    @keyframes coronaBreath {
        0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
        50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.15); }
    }
    @keyframes laserLineSweep {
        0% { transform: translateX(-100%); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateX(100%); opacity: 0; }
    }
    @keyframes floatSubtle {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-3px); }
    }
    @keyframes borderGlowPulse {
        0%, 100% { box-shadow: 0 0 8px rgba(6,182,212,0.3), inset 0 0 8px rgba(6,182,212,0.1); }
        50% { box-shadow: 0 0 20px rgba(6,182,212,0.6), inset 0 0 15px rgba(6,182,212,0.2); }
    }
    @keyframes letterReveal {
        0% { opacity: 0; transform: translateY(20px) scale(0.8); filter: blur(8px); }
        100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
    }

    .god-title-container {
        position: relative;
        perspective: 1000px;
    }

    .god-title-main {
        font-family: 'Cinzel Decorative', 'Playfair Display', 'Georgia', serif;
        font-size: clamp(2.5rem, 6vw, 5rem);
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.25em;
        line-height: 1.15;
        text-align: center;
        background: linear-gradient(
            90deg,
            #94a3b8 0%,
            #e2e8f0 12%,
            #ffffff 20%,
            #67e8f9 35%,
            #06b6d4 50%,
            #67e8f9 65%,
            #ffffff 80%,
            #e2e8f0 88%,
            #94a3b8 100%
        );
        background-size: 300% auto;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
        animation: prismaticShine 6s linear infinite;
        filter:
            drop-shadow(0 0 40px rgba(6, 182, 212, 0.9))
            drop-shadow(0 0 80px rgba(6, 182, 212, 0.4))
            drop-shadow(0 5px 15px rgba(0, 0, 0, 0.8));
        position: relative;
        z-index: 10;
    }

    .god-title-main::before {
        content: attr(data-text);
        position: absolute;
        inset: 0;
        background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.15) 45%,
            rgba(255,255,255,0.35) 50%,
            rgba(255,255,255,0.15) 55%,
            transparent 100%
        );
        background-size: 300% auto;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
        animation: prismaticShine 3s linear infinite;
        z-index: 11;
        pointer-events: none;
    }

    .god-subtitle {
        font-family: 'Cinzel', 'Playfair Display', serif;
        font-size: clamp(1rem, 2.5vw, 1.8rem);
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5em;
        background: linear-gradient(
            90deg,
            #3b82f6 0%,
            #22d3ee 20%,
            #ffffff 50%,
            #22d3ee 80%,
            #3b82f6 100%
        );
        background-size: 250% auto;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
        animation: prismaticShine 4s reverse linear infinite, floatSubtle 4s ease-in-out infinite;
        filter: drop-shadow(0 0 25px rgba(34, 211, 238, 0.9)) drop-shadow(0 4px 10px rgba(0,0,0,0.8));
        position: relative;
        z-index: 10;
    }

    .god-location {
        font-family: 'Inter', 'Segoe UI', sans-serif;
        font-size: clamp(0.65rem, 1.5vw, 0.95rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.7em;
        color: #cffafe;
        text-shadow: 0 0 20px rgba(6, 182, 212, 0.8), 0 0 40px rgba(6, 182, 212, 0.3);
        animation: floatSubtle 5s ease-in-out infinite reverse;
        position: relative;
        z-index: 10;
    }

    .god-divider {
        position: relative;
        height: 3px;
        flex-grow: 1;
        border-radius: 2px;
        overflow: hidden;
    }
    .god-divider::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to var(--dir, right), transparent, rgba(6,182,212,0.5), #22d3ee, #ffffff, #22d3ee, rgba(6,182,212,0.5), transparent);
        box-shadow: 0 0 15px rgba(6,182,212,0.8);
    }
    .god-divider::after {
        content: '';
        position: absolute;
        top: 0; bottom: 0;
        width: 40%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent);
        animation: laserLineSweep 3s ease-in-out infinite;
    }

    .god-corona {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 120%;
        height: 300%;
        background: radial-gradient(ellipse at center,
            rgba(6, 182, 212, 0.15) 0%,
            rgba(59, 130, 246, 0.08) 30%,
            transparent 65%
        );
        animation: coronaBreath 5s ease-in-out infinite;
        pointer-events: none;
        z-index: 0;
        filter: blur(30px);
    }

    .god-diamond-separator {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin: 0 12px;
    }
    .god-diamond-separator .diamond {
        width: 8px;
        height: 8px;
        background: #22d3ee;
        transform: rotate(45deg);
        box-shadow: 0 0 10px #22d3ee, 0 0 20px rgba(34,211,238,0.5);
        animation: borderGlowPulse 2s ease-in-out infinite;
    }
    .god-diamond-separator .diamond.small {
        width: 5px;
        height: 5px;
        background: rgba(34,211,238,0.6);
        box-shadow: 0 0 6px rgba(34,211,238,0.5);
    }

    .god-ornament-line {
        height: 1px;
        flex-grow: 1;
        background: linear-gradient(to var(--dir, right), transparent, rgba(6,182,212,0.4));
    }"""

if old_keyframe in text:
    text = text.replace(old_keyframe, new_keyframe)
    print("Step 1: CSS injected successfully!")
else:
    print("Step 1: Could not find old keyframe!")

# ===== STEP 2: Replace the title HTML block =====
old_title_block = """                <div class="w-full text-center flex flex-col items-center justify-center pt-0 pb-0 mb-3 mt-2 lg:mt-6 relative">
                    <!-- Ambient backglow for the whole title area -->
                    <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-[200%] bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.1)_0%,transparent_60%)] pointer-events-none blur-xl z-0"></div>

                    <div class="flex flex-wrap items-center justify-center gap-3 lg:gap-5 mb-1 relative z-10">
                        <h1 id="mainTitle" class="text-5xl lg:text-6xl font-serif font-black uppercase tracking-[0.3em] leading-tight text-center relative" 
                            style="
                                background: linear-gradient(to right, #ffffff 0%, #cffafe 25%, #06b6d4 50%, #cffafe 75%, #ffffff 100%); 
                                background-size: 200% auto; 
                                -webkit-background-clip: text; 
                                background-clip: text; 
                                color: transparent; 
                                -webkit-text-fill-color: transparent; 
                                filter: drop-shadow(0 0 30px rgba(6, 182, 212, 0.8)) drop-shadow(0 0 10px rgba(255, 255, 255, 0.6)); 
                                animation: shine 4s linear infinite;
                            ">
                            PRESENSI<br>BIOMETRIK
                        </h1>
                    </div>
                    
                    <div class="flex items-center justify-center w-full max-w-2xl mb-3 mt-4 relative z-10">
                        <div class="h-[2px] flex-grow" style="background: linear-gradient(to right, transparent, rgba(34,211,238,0.8), #ffffff); box-shadow: 0 0 10px rgba(6,182,212,0.8);"></div>
                        
                        <h2 class="px-6 text-xl lg:text-2xl font-serif font-extrabold tracking-[0.4em] uppercase relative" 
                            style="
                                background: linear-gradient(90deg, #3b82f6 0%, #22d3ee 30%, #ffffff 50%, #22d3ee 70%, #3b82f6 100%); 
                                background-size: 200% auto; 
                                -webkit-background-clip: text; 
                                background-clip: text; 
                                color: transparent; 
                                -webkit-text-fill-color: transparent; 
                                filter: drop-shadow(0 0 20px rgba(34, 211, 238, 0.9)); 
                                animation: shine 3s reverse linear infinite;
                            ">
                            PUSKESMAS WANA
                        </h2>
                        
                        <div class="h-[2px] flex-grow" style="background: linear-gradient(to left, transparent, rgba(34,211,238,0.8), #ffffff); box-shadow: 0 0 10px rgba(6,182,212,0.8);"></div>
                    </div>
                    
                    <h3 class="text-sm lg:text-base font-sans font-bold tracking-[0.6em] uppercase mb-2 relative z-10"
                        style="
                            color: #cffafe;
                            text-shadow: 0 0 12px rgba(6, 182, 212, 0.7);
                        ">
                        KABUPATEN LAMPUNG TIMUR
                    </h3>
                </div>"""

new_title_block = """                <div class="w-full text-center flex flex-col items-center justify-center pt-0 pb-0 mb-3 mt-2 lg:mt-6 relative god-title-container">
                    <!-- Multi-layer Corona Backglow -->
                    <div class="god-corona"></div>
                    <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[60%] h-[120%] rounded-full pointer-events-none z-0" style="background: radial-gradient(ellipse at center, rgba(59,130,246,0.12) 0%, transparent 70%); filter: blur(40px); animation: coronaBreath 7s ease-in-out infinite reverse;"></div>

                    <!-- Decorative Top Ornament -->
                    <div class="flex items-center w-full max-w-lg mb-4 relative z-10">
                        <div class="god-ornament-line" style="--dir: right;"></div>
                        <div class="god-diamond-separator">
                            <div class="diamond small"></div>
                            <div class="diamond"></div>
                            <div class="diamond small"></div>
                        </div>
                        <div class="god-ornament-line" style="--dir: left;"></div>
                    </div>

                    <!-- Main Title -->
                    <div class="flex flex-wrap items-center justify-center gap-3 lg:gap-5 mb-2 relative z-10">
                        <h1 id="mainTitle" class="god-title-main" data-text="PRESENSI BIOMETRIK">
                            PRESENSI<br>BIOMETRIK
                        </h1>
                    </div>
                    
                    <!-- Laser Divider + Subtitle -->
                    <div class="flex items-center justify-center w-full max-w-2xl mb-3 mt-2 relative z-10">
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
                    <div class="flex items-center w-full max-w-xs mt-2 mb-1 relative z-10">
                        <div class="god-ornament-line" style="--dir: right;"></div>
                        <div class="god-diamond-separator">
                            <div class="diamond small"></div>
                        </div>
                        <div class="god-ornament-line" style="--dir: left;"></div>
                    </div>
                </div>"""

if old_title_block in text:
    text = text.replace(old_title_block, new_title_block)
    print("Step 2: Title HTML replaced successfully!")
else:
    print("Step 2: Could not find old title block!")

# ===== STEP 3: Add Google Fonts link if not already there =====
if 'Cinzel+Decorative' not in text:
    text = text.replace('<head>', '<head>\n    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n    <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@700;800;900&display=swap" rel="stylesheet">')
    print("Step 3: Google Fonts added!")
else:
    print("Step 3: Fonts already present.")

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("\n=== GOD-TIER TITLE APPLIED SUCCESSFULLY ===")
