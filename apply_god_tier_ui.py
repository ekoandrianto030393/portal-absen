import os
import re

# ==========================================
# 1. UPGRADE SCAN.HTML (THE PANELS)
# ==========================================
with open('scan.html', 'r', encoding='utf-8') as f:
    html_text = f.read()

new_html_css = """    /* === GOD-TIER OBSIDIAN PRISM PANELS === */
    #cuti-panel, #dl-panel, #hadir-panel {
        background: linear-gradient(180deg, rgba(15, 15, 20, 0.4) 0%, rgba(5, 5, 10, 0.9) 100%) !important;
        backdrop-filter: blur(24px) saturate(150%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(150%) !important;
        border-radius: 24px !important;
        border: 1px solid rgba(255, 255, 255, 0.03) !important;
        position: relative;
        overflow: hidden;
    }
    
    /* Subtle inner noise texture */
    #cuti-panel::after, #dl-panel::after, #hadir-panel::after {
        content: '';
        position: absolute;
        inset: 0;
        opacity: 0.15;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        pointer-events: none;
        z-index: 0;
    }

    /* Holographic Top Rim */
    #cuti-panel::before, #dl-panel::before, #hadir-panel::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: 24px;
        padding: 1.5px;
        background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.1) 100%) !important;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        opacity: 1;
        z-index: 1;
    }
    
    /* Specific glowing bottom lips and ultra-deep shadows */
    #cuti-panel { 
        border-bottom: 2px solid rgba(245, 158, 11, 0.8) !important;
        box-shadow: 0 30px 60px rgba(0,0,0,0.9), inset 0 30px 60px -30px rgba(245, 158, 11, 0.15), 0 15px 45px rgba(245, 158, 11, 0.15) !important; 
    }
    #dl-panel { 
        border-bottom: 2px solid rgba(139, 92, 246, 0.8) !important;
        box-shadow: 0 30px 60px rgba(0,0,0,0.9), inset 0 30px 60px -30px rgba(139, 92, 246, 0.15), 0 15px 45px rgba(139, 92, 246, 0.15) !important; 
    }
    #hadir-panel { 
        border-bottom: 2px solid rgba(16, 185, 129, 0.8) !important;
        box-shadow: 0 30px 60px rgba(0,0,0,0.9), inset 0 30px 60px -30px rgba(16, 185, 129, 0.15), 0 15px 45px rgba(16, 185, 129, 0.15) !important; 
    }
"""

start_marker = "    /* === HOLOGRAPHIC FROSTED GLASS (GOD TIER) === */"
end_marker = "0.1) !important; }\n"
if start_marker in html_text and end_marker in html_text:
    start_idx = html_text.find(start_marker)
    end_idx = html_text.find(end_marker) + len(end_marker)
    html_text = html_text[:start_idx] + new_html_css + html_text[end_idx:]

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(html_text)


# ==========================================
# 2. UPGRADE SCAN.JS (THE ROSTER CARDS)
# ==========================================
with open('scan.js', 'r', encoding='utf-8') as f:
    js_text = f.read()

# I will use a regex to replace the entire block of if/else logic for colors, up to transform-style: preserve-3d;
regex_pattern = r'if \(isCuti\) \{.*transform-style: preserve-3d;\n\s+`;'

new_js_logic = """
            // === BEYOND GOD-TIER CARD STYLING ===
            const statusConfig = {
                cuti:  { glow: '#f59e0b', accent: '#fbbf24', text: 'CUTI', bg1: 'rgba(40, 20, 0, 0.85)', bg2: 'rgba(20, 5, 0, 0.95)' },
                dl:    { glow: '#8b5cf6', accent: '#c084fc', text: 'DINAS LUAR', bg1: 'rgba(25, 10, 45, 0.85)', bg2: 'rgba(10, 0, 20, 0.95)' },
                out:   { glow: '#f43f5e', accent: '#fb7185', text: 'PULANG', bg1: 'rgba(45, 10, 15, 0.85)', bg2: 'rgba(20, 0, 5, 0.95)' },
                hadir: { glow: '#10b981', accent: '#34d399', text: 'HADIR', bg1: 'rgba(5, 30, 20, 0.85)', bg2: 'rgba(0, 10, 5, 0.95)' }
            };

            const cfg = isCuti ? statusConfig.cuti : isDL ? statusConfig.dl : isOut ? statusConfig.out : statusConfig.hadir;
            
            glowColor = cfg.glow;
            const accentColor = cfg.accent;
            badgeStyle = `background: transparent; color: ${cfg.accent}; border: 1px solid ${cfg.glow}40; box-shadow: inset 0 0 10px ${cfg.glow}20, 0 0 10px ${cfg.glow}40;`;
            timeGradient = `color: ${cfg.accent}; text-shadow: 0 0 8px ${cfg.glow}; font-weight: 900; letter-spacing: 1px;`;
            statusLabelHtml = `<span class="text-[9px] px-2.5 py-0.5 rounded border font-black tracking-[0.25em] uppercase" style="${badgeStyle}">${cfg.text}</span>`;

            const item = document.createElement('div');
            item.className = `roster-card-3d group flex items-center p-2.5 rounded-xl border transition-all duration-500 animate-[fadeIn_0.6s_cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden select-none cursor-pointer mb-2 mx-1`;

            const cardBg = `linear-gradient(135deg, ${cfg.bg1} 0%, ${cfg.bg2} 100%)`;
            
            // Premium Carbon Fiber / Hex mix
            const motifBg = `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 0L12 6L6 12L0 6L6 0Z' fill='%23ffffff' fill-opacity='0.02' fill-rule='evenodd'/%3E%3C/svg%3E")`;

            item.style.cssText = `
                background: ${cardBg}, ${motifBg};
                background-size: cover, 12px 12px;
                border-color: rgba(255,255,255,0.05);
                box-shadow: 
                    0 15px 35px rgba(0,0,0,0.8), 
                    inset 0 1px 0 rgba(255,255,255,0.1), 
                    inset 0 0 30px ${glowColor}10,
                    0 0 0 1px ${glowColor}20;
                transform-style: preserve-3d;
            `;"""

js_text = re.sub(regex_pattern, new_js_logic.strip(), js_text, flags=re.DOTALL)

# Fix the Left Accent Glow line in scan.js to use cfg.accent and cfg.glow properly
js_text = re.sub(
    r'<!-- Ultra Premium Left Accent Glow -->.*?</div>',
    r'<!-- Ultra Premium Left Accent Glow -->\n                <div class="absolute left-0 top-0 bottom-0 w-[4px] z-20 rounded-l-xl" style="background: linear-gradient(to bottom, transparent, ${accentColor}, transparent); box-shadow: 0 0 15px ${glowColor}, 0 0 25px ${glowColor}80;"></div>',
    js_text,
    flags=re.DOTALL
)

with open('scan.js', 'w', encoding='utf-8') as f:
    f.write(js_text)

print("=== GOD-TIER OBSIDIAN PRISM UI APPLIED ===")
