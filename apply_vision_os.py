import os
import re

# ==========================================
# 1. UPGRADE SCAN.HTML (VisionOS Aurora Panels)
# ==========================================
with open('scan.html', 'r', encoding='utf-8') as f:
    html_text = f.read()

old_css_rule = r"""    /\* === GOD-TIER JEWEL GLASS PANELS === \*/
    #cuti-panel, #dl-panel, #hadir-panel \{
        backdrop-filter: blur\(24px\) saturate\(200%\) !important;
        -webkit-backdrop-filter: blur\(24px\) saturate\(200%\) !important;
        border-radius: 24px !important;
        border: 1px solid rgba\(255, 255, 255, 0\.1\) !important;
        position: relative;
        overflow: hidden;
    \}
    #cuti-panel \{ background: linear-gradient\(160deg, rgba\(120, 53, 15, 0\.4\) 0%, rgba\(67, 20, 7, 0\.8\) 100%\) !important; \}
    #dl-panel \{ background: linear-gradient\(160deg, rgba\(76, 29, 149, 0\.4\) 0%, rgba\(46, 16, 101, 0\.8\) 100%\) !important; \}
    #hadir-panel \{ background: linear-gradient\(160deg, rgba\(6, 78, 59, 0\.4\) 0%, rgba\(2, 44, 34, 0\.8\) 100%\) !important; \}"""

new_css_rule = """    /* === APPLE VISION-OS AURORA GLASS PANELS === */
    #cuti-panel, #dl-panel, #hadir-panel {
        backdrop-filter: blur(40px) saturate(200%) !important;
        -webkit-backdrop-filter: blur(40px) saturate(200%) !important;
        border-radius: 30px !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.3) !important;
        border-left: 1px solid rgba(255, 255, 255, 0.25) !important;
        box-shadow: 0 25px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.2) !important;
        position: relative;
        overflow: hidden;
    }
    
    #hadir-panel { 
        background: 
            radial-gradient(circle at 10% 0%, rgba(16, 185, 129, 0.3) 0%, transparent 60%),
            radial-gradient(circle at 90% 100%, rgba(6, 182, 212, 0.25) 0%, transparent 60%),
            rgba(10, 15, 20, 0.5) !important;
    }
    #cuti-panel { 
        background: 
            radial-gradient(circle at 10% 0%, rgba(245, 158, 11, 0.3) 0%, transparent 60%),
            radial-gradient(circle at 90% 100%, rgba(225, 29, 72, 0.25) 0%, transparent 60%),
            rgba(20, 10, 10, 0.5) !important;
    }
    #dl-panel { 
        background: 
            radial-gradient(circle at 10% 0%, rgba(139, 92, 246, 0.3) 0%, transparent 60%),
            radial-gradient(circle at 90% 100%, rgba(217, 70, 239, 0.25) 0%, transparent 60%),
            rgba(15, 10, 25, 0.5) !important;
    }"""

html_text = re.sub(old_css_rule, new_css_rule, html_text, flags=re.DOTALL)

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(html_text)


# ==========================================
# 2. UPGRADE SCAN.JS (Clean VisionOS Cards)
# ==========================================
with open('scan.js', 'r', encoding='utf-8') as f:
    js_text = f.read()

old_config_block = r"""            const statusConfig = \{
                cuti:  \{ glow: '#f97316', accent: '#fdba74', text: 'CUTI', bg1: 'rgba\(255, 237, 213, 0\.15\)', bg2: 'rgba\(255, 255, 255, 0\.05\)' \},
                dl:    \{ glow: '#8b5cf6', accent: '#d8b4fe', text: 'DINAS LUAR', bg1: 'rgba\(243, 232, 255, 0\.15\)', bg2: 'rgba\(255, 255, 255, 0\.05\)' \},
                out:   \{ glow: '#f43f5e', accent: '#fda4af', text: 'PULANG', bg1: 'rgba\(255, 228, 230, 0\.15\)', bg2: 'rgba\(255, 255, 255, 0\.05\)' \},
                hadir: \{ glow: '#10b981', accent: '#6ee7b7', text: 'HADIR', bg1: 'rgba\(209, 250, 229, 0\.15\)', bg2: 'rgba\(255, 255, 255, 0\.05\)' \}
            \};"""

new_config_block = """            const statusConfig = {
                cuti:  { glow: '#f59e0b', accent: '#fbbf24', text: 'CUTI', bg1: 'rgba(255, 255, 255, 0.1)', bg2: 'rgba(255, 255, 255, 0.02)' },
                dl:    { glow: '#8b5cf6', accent: '#c084fc', text: 'DINAS LUAR', bg1: 'rgba(255, 255, 255, 0.1)', bg2: 'rgba(255, 255, 255, 0.02)' },
                out:   { glow: '#f43f5e', accent: '#fb7185', text: 'PULANG', bg1: 'rgba(255, 255, 255, 0.1)', bg2: 'rgba(255, 255, 255, 0.02)' },
                hadir: { glow: '#10b981', accent: '#34d399', text: 'HADIR', bg1: 'rgba(255, 255, 255, 0.1)', bg2: 'rgba(255, 255, 255, 0.02)' }
            };"""

js_text = re.sub(old_config_block, new_config_block, js_text, flags=re.DOTALL)


# Replace the item.style.cssText
old_card_style = r"""            item.style.cssText = `
                background: \$\{cardBg\}, \$\{motifBg\};
                background-size: cover, 12px 12px;
                border-color: rgba\(255,255,255,0\.05\);
                box-shadow: 
                    0 15px 35px rgba\(0,0,0,0\.8\), 
                    inset 0 1px 0 rgba\(255,255,255,0\.1\), 
                    inset 0 0 30px \$\{glowColor\}10,
                    0 0 0 1px \$\{glowColor\}20;
                transform-style: preserve-3d;
            `;"""

new_card_style = """            item.style.cssText = `
                background: ${cardBg};
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-top: 1px solid rgba(255, 255, 255, 0.3);
                border-left: 1px solid rgba(255, 255, 255, 0.25);
                box-shadow: 0 15px 35px rgba(0,0,0,0.4), 0 5px 15px rgba(0,0,0,0.2);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-radius: 18px;
                transform-style: preserve-3d;
            `;"""

js_text = re.sub(old_card_style, new_card_style, js_text, flags=re.DOTALL)

with open('scan.js', 'w', encoding='utf-8') as f:
    f.write(js_text)

print("Colors updated to Apple VisionOS Aurora Glass!")
