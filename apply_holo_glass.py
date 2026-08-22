import os
import re

with open('scan.html', 'r', encoding='utf-8') as f:
    text = f.read()

new_css = """    /* === HOLOGRAPHIC FROSTED GLASS (GOD TIER) === */
    #cuti-panel, #dl-panel, #hadir-panel {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.01) 100%) !important;
        backdrop-filter: blur(16px) saturate(120%) !important;
        -webkit-backdrop-filter: blur(16px) saturate(120%) !important;
        border-radius: 20px !important;
        border: none !important;
        position: relative;
    }
    
    /* Holographic Border */
    #cuti-panel::before, #dl-panel::before, #hadir-panel::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: 20px;
        padding: 1.5px;
        background: linear-gradient(135deg, 
            rgba(251, 191, 36, 0.7),
            rgba(244, 114, 182, 0.7),
            rgba(56, 189, 248, 0.7),
            rgba(167, 139, 250, 0.7),
            rgba(52, 211, 153, 0.7)
        ) !important;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        opacity: 0.8;
    }
    
    /* Subtly colored inner glow for each */
    #cuti-panel { box-shadow: 0 15px 35px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255, 0.25), inset 0 0 40px rgba(245, 158, 11, 0.1) !important; }
    #dl-panel { box-shadow: 0 15px 35px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255, 0.25), inset 0 0 40px rgba(139, 92, 246, 0.1) !important; }
    #hadir-panel { box-shadow: 0 15px 35px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255, 0.25), inset 0 0 40px rgba(16, 185, 129, 0.1) !important; }
"""

start_marker = "    /* === ULTIMATE STATIC PREMIUM PANEL COLORS === */"
end_marker = "        transform: translateY(-2px);\n    }\n"
if start_marker in text and end_marker in text:
    start_idx = text.find(start_marker)
    end_idx = text.find(end_marker) + len(end_marker)
    text = text[:start_idx] + new_css + text[end_idx:]

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("=== HOLOGRAPHIC FROSTED GLASS APPLIED ===")
