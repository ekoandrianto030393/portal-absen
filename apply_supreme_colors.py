import os
import re

with open('scan.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update CSS with Ultra-Premium Mesh Gradients for Panels
new_css = """    /* === ULTIMATE STATIC PREMIUM PANEL COLORS === */
    /* CUTI PEGAWAI: Amber & Rose */
    #cuti-panel {
        background: 
            radial-gradient(circle at 0% 0%, rgba(245, 158, 11, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 100% 100%, rgba(225, 29, 72, 0.15) 0%, transparent 40%),
            linear-gradient(145deg, #09090b 0%, #18181b 50%, #09090b 100%) !important;
        border: 1px solid rgba(245, 158, 11, 0.2) !important;
        border-top: 2px solid rgba(245, 158, 11, 0.6) !important;
        border-bottom: 2px solid rgba(225, 29, 72, 0.4) !important;
        box-shadow: 0 25px 50px rgba(0,0,0,0.8), inset 0 2px 20px rgba(245, 158, 11, 0.05) !important;
    }
    
    /* DINAS LUAR: Violet & Fuchsia */
    #dl-panel {
        background: 
            radial-gradient(circle at 0% 0%, rgba(139, 92, 246, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 100% 100%, rgba(217, 70, 239, 0.15) 0%, transparent 40%),
            linear-gradient(145deg, #09090b 0%, #18181b 50%, #09090b 100%) !important;
        border: 1px solid rgba(139, 92, 246, 0.2) !important;
        border-top: 2px solid rgba(139, 92, 246, 0.6) !important;
        border-bottom: 2px solid rgba(217, 70, 239, 0.4) !important;
        box-shadow: 0 25px 50px rgba(0,0,0,0.8), inset 0 2px 20px rgba(139, 92, 246, 0.05) !important;
    }
    
    /* DAFTAR HADIR: Emerald & Cyan */
    #hadir-panel {
        background: 
            radial-gradient(circle at 0% 0%, rgba(16, 185, 129, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 100% 100%, rgba(6, 182, 212, 0.15) 0%, transparent 40%),
            linear-gradient(145deg, #09090b 0%, #18181b 50%, #09090b 100%) !important;
        border: 1px solid rgba(16, 185, 129, 0.2) !important;
        border-top: 2px solid rgba(16, 185, 129, 0.6) !important;
        border-bottom: 2px solid rgba(6, 182, 212, 0.4) !important;
        box-shadow: 0 25px 50px rgba(0,0,0,0.8), inset 0 2px 20px rgba(16, 185, 129, 0.05) !important;
    }
"""
# Replace the previous block of panel colors
start_marker = "    /* === ULTIMATE STATIC PREMIUM PANEL COLORS === */"
end_marker = "        transform: translateY(-2px);\n    }\n"
if start_marker in text and end_marker in text:
    start_idx = text.find(start_marker)
    end_idx = text.find(end_marker) + len(end_marker)
    text = text[:start_idx] + new_css + text[end_idx:]

# 2. Update HTML colors for CUTI PEGAWAI (Amber & Rose)
# Old colors: #FFD700, #DAA520
# We want Amber #f59e0b and Rose #e11d48
text = re.sub(r'style="background: linear-gradient\(to bottom, #FFD700, #DAA520\); box-shadow: 0 0 8px #FFD70060;"', 
              r'style="background: linear-gradient(to bottom, #f59e0b, #e11d48); box-shadow: 0 0 8px rgba(245,158,11,0.6);"', text)
text = re.sub(r'<i class="fa-solid fa-umbrella-beach" style="color: #FFD700;"></i>', 
              r'<i class="fa-solid fa-umbrella-beach" style="color: #f59e0b;"></i>', text)
text = re.sub(r'style="background: linear-gradient\(to right, rgba\(255,215,0,0.4\), transparent\);"', 
              r'style="background: linear-gradient(to right, rgba(245,158,11,0.4), transparent);"', text)
text = re.sub(r'style="background: rgba\(255,215,0,0.2\);"', 
              r'style="background: rgba(245,158,11,0.2);"', text)
text = re.sub(r'style="background: rgba\(6,10,20,0.95\); border: 1px solid rgba\(255,215,0,0.3\); box-shadow: 0 0 20px rgba\(255,215,0,0.15\), inset 0 1px 0 rgba\(218,165,32,0.1\);"', 
              r'style="background: rgba(6,10,20,0.95); border: 1px solid rgba(245,158,11,0.3); box-shadow: 0 0 20px rgba(245,158,11,0.15), inset 0 1px 0 rgba(245,158,11,0.1);"', text)
text = re.sub(r'style="color: #DAA520; text-shadow: 0 0 15px rgba\(255,215,0,0.8\);"', 
              r'style="color: #f59e0b; text-shadow: 0 0 15px rgba(245,158,11,0.8);"', text)
text = re.sub(r'style="background: rgba\(255,215,0,0.3\);"', 
              r'style="background: rgba(245,158,11,0.3);"', text)
text = re.sub(r'style="text-shadow: 0 2px 4px rgba\(0,0,0,0.9\), 0 0 10px rgba\(255,215,0,0.6\);"', 
              r'style="text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 10px rgba(245,158,11,0.6);"', text)

# 3. Update HTML colors for DINAS LUAR (Violet & Fuchsia)
# Old colors: #CD853F, rgba(184,134,11)
text = re.sub(r'style="background: linear-gradient\(to bottom, #CD853F, #CD853F\); box-shadow: 0 0 8px #CD853F60;"', 
              r'style="background: linear-gradient(to bottom, #8b5cf6, #d946ef); box-shadow: 0 0 8px rgba(139,92,246,0.6);"', text)
text = re.sub(r'<i class="fa-solid fa-car" style="color: #CD853F;"></i>', 
              r'<i class="fa-solid fa-car" style="color: #8b5cf6;"></i>', text)
text = re.sub(r'style="background: linear-gradient\(to right, rgba\(184,134,11,0.4\), transparent\);"', 
              r'style="background: linear-gradient(to right, rgba(139,92,246,0.4), transparent);"', text)
text = re.sub(r'style="background: rgba\(184,134,11,0.2\);"', 
              r'style="background: rgba(139,92,246,0.2);"', text)
text = re.sub(r'style="background: rgba\(6,10,20,0.95\); border: 1px solid rgba\(184,134,11,0.3\); box-shadow: 0 0 20px rgba\(184,134,11,0.15\), inset 0 1px 0 rgba\(184,134,11,0.08\);"', 
              r'style="background: rgba(6,10,20,0.95); border: 1px solid rgba(139,92,246,0.3); box-shadow: 0 0 20px rgba(139,92,246,0.15), inset 0 1px 0 rgba(139,92,246,0.1);"', text)
text = re.sub(r'style="color: #CD853F; text-shadow: 0 0 15px rgba\(184,134,11,0.8\);"', 
              r'style="color: #8b5cf6; text-shadow: 0 0 15px rgba(139,92,246,0.8);"', text)
text = re.sub(r'style="background: rgba\(184,134,11,0.3\);"', 
              r'style="background: rgba(139,92,246,0.3);"', text)
text = re.sub(r'style="text-shadow: 0 2px 4px rgba\(0,0,0,0.9\), 0 0 10px rgba\(205,133,63,0.6\);"', 
              r'style="text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 10px rgba(139,92,246,0.6);"', text)
text = re.sub(r'style="background: rgba\(184,134,11,0.15\);"', 
              r'style="background: rgba(139,92,246,0.15);"', text)

# 4. Update HTML colors for DAFTAR HADIR (Emerald & Cyan)
# Old colors: #DAA520, #B8860B
text = re.sub(r'style="background: linear-gradient\(to bottom, #DAA520, #B8860B\); box-shadow: 0 0 8px #DAA52060;"', 
              r'style="background: linear-gradient(to bottom, #10b981, #06b6d4); box-shadow: 0 0 8px rgba(16,185,129,0.6);"', text)
text = re.sub(r'<i class="fa-solid fa-clipboard-check" style="color: #DAA520;"></i>', 
              r'<i class="fa-solid fa-clipboard-check" style="color: #10b981;"></i>', text)
text = re.sub(r'style="background: linear-gradient\(to right, rgba\(218,165,32,0.4\), transparent\);"', 
              r'style="background: linear-gradient(to right, rgba(16,185,129,0.4), transparent);"', text)
text = re.sub(r'style="background: rgba\(218,165,32,0.25\);"', 
              r'style="background: rgba(16,185,129,0.25);"', text)
text = re.sub(r'style="background: rgba\(6,10,20,0.95\); border: 1px solid rgba\(218,165,32,0.4\); box-shadow: 0 0 25px rgba\(218,165,32,0.2\), inset 0 1px 0 rgba\(218,165,32,0.1\);"', 
              r'style="background: rgba(6,10,20,0.95); border: 1px solid rgba(16,185,129,0.4); box-shadow: 0 0 25px rgba(16,185,129,0.2), inset 0 1px 0 rgba(16,185,129,0.1);"', text)
text = re.sub(r'style="color: #DAA520; text-shadow: 0 0 15px rgba\(218,165,32,0.8\);"', 
              r'style="color: #10b981; text-shadow: 0 0 15px rgba(16,185,129,0.8);"', text)
text = re.sub(r'style="text-shadow: 0 2px 4px rgba\(0,0,0,0.9\), 0 0 10px rgba\(218,165,32,0.6\);"', 
              r'style="text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 10px rgba(16,185,129,0.6);"', text)
text = re.sub(r'style="background: rgba\(218,165,32,0.15\);"', 
              r'style="background: rgba(16,185,129,0.15);"', text)
              
# Fix the badge inner text color for 'MEMUAT DATA KEHADIRAN'
text = text.replace('class="text-[#DAA520]/60', 'class="text-[#10b981]/60')

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("=== SUPREME COLOR COMBINATION APPLIED ===")
