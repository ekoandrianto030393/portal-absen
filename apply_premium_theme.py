import os
import re

def apply_premium_theme(text):
    # 1. Backgrounds (Deep Cyber-Jade -> Deep Midnight Space)
    text = text.replace('#060a14', '#020617') # Slate 950
    text = text.replace('#050810', '#020617')
    text = text.replace('#0a1628', '#0f172a') # Slate 900
    text = text.replace('#0d1a3c', '#1e293b') # Slate 800
    text = text.replace('rgba(6, 10, 20,', 'rgba(2, 6, 23,')
    text = text.replace('rgba(10, 15, 32,', 'rgba(15, 23, 42,')
    text = text.replace('rgba(10, 15, 35,', 'rgba(15, 23, 42,')
    text = text.replace('rgba(4, 8, 18,', 'rgba(2, 6, 23,')
    text = text.replace('rgba(10, 18, 38,', 'rgba(15, 23, 42,')
    
    # 2. Emerald / Jade -> Premium Cyan / Sky
    text = text.replace('rgba(52, 211, 153,', 'rgba(14, 165, 233,') # Sky 500
    text = text.replace('#34d399', '#38bdf8') # Sky 400
    text = text.replace('#6ee7b7', '#7dd3fc') # Sky 300
    text = text.replace('#00e5a0', '#00f2fe') # Neon Cyan
    text = text.replace('#00fff5', '#4facfe') # Blue Cyan
    
    # 3. Rose / Pink -> Violet / Purple
    text = text.replace('rgba(244, 114, 182,', 'rgba(139, 92, 246,') # Violet 500
    text = text.replace('#f472b6', '#a78bfa') # Violet 400
    
    # 4. Indigo -> Deep Fuchsia / Pink
    text = text.replace('rgba(99, 102, 241,', 'rgba(217, 70, 239,') # Fuchsia 500
    text = text.replace('#6366f1', '#d946ef') # Fuchsia 500
    text = text.replace('rgba(129, 140, 248,', 'rgba(232, 121, 249,') # Fuchsia 400
    text = text.replace('#818cf8', '#e879f9') # Fuchsia 400
    
    # 5. Cyan (Old) -> Teal / Mint
    text = text.replace('rgba(34, 211, 238,', 'rgba(45, 212, 191,') # Teal 400
    text = text.replace('#22d3ee', '#2dd4bf') # Teal 400
    text = text.replace('rgba(56, 189, 248,', 'rgba(20, 184, 166,') # Teal 500
    text = text.replace('#38bdf8', '#14b8a6') # Teal 500
    text = text.replace('#06b6d4', '#0f766e') # Teal 700

    # 6. Specific classes and tweaks
    # Make the "Hadir" counter badge shine in Cyan
    text = text.replace('shadow-[0_0_15px_rgba(52,211,153,0.8)]', 'shadow-[0_0_20px_rgba(14,165,233,0.9)]')
    
    # Make "Cuti" (Amber) slightly more premium Gold
    text = text.replace('#fbbf24', '#facc15') # Yellow 400
    text = text.replace('#f59e0b', '#eab308') # Yellow 500
    text = text.replace('rgba(251,191,36,', 'rgba(250,204,21,')
    
    return text

for filename in ['scan.html', 'scan.js']:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = apply_premium_theme(content)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Applied Premium Oceanic Aurora theme to {filename}")
