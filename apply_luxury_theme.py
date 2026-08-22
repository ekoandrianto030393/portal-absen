import os
def apply_luxury_theme(text):
    # A palette that screams "Luxury & Elegance"
    # Primary: Metallic Champagne Gold (#D4AF37)
    # Secondary: Deep Obsidian Black (#050505)
    # Accents: Diamond Silver (#E5E4E2)
    
    # 1. Emerald -> Champagne Gold
    text = text.replace('#10b981', '#D4AF37') 
    text = text.replace('rgba(16,185,129,', 'rgba(212,175,55,')
    text = text.replace('rgba(16, 185, 129,', 'rgba(212, 175, 55,')
    
    # 2. Teal -> Darker Royal Gold
    text = text.replace('#0d9488', '#AA8C2C')
    text = text.replace('rgba(13,148,136,', 'rgba(170,140,44,')
    text = text.replace('rgba(13, 148, 136,', 'rgba(170, 140, 44,')
    
    # 3. Emerald 700 -> Bronze/Deep Gold
    text = text.replace('#047857', '#806921')
    
    # 4. Emerald 400 -> Bright Light Gold (for highlights)
    text = text.replace('#34d399', '#F4E087')
    text = text.replace('rgba(52, 211, 153,', 'rgba(244, 224, 135,')
    
    # 5. Emerald 200 -> Diamond/Platinum White
    text = text.replace('#a7f3d0', '#F9F6EE')
    
    # 6. Some Sky Blues we might have added
    text = text.replace('#0ea5e9', '#00f2fe') # Keep sky blues but make them icy
    text = text.replace('#0284c7', '#4facfe')
    # Enhance backgrounds for pure elegance
    text = text.replace('bg-[#030712]', 'bg-[#000000]')
    text = text.replace('bg-[#030712]/80', 'bg-[#050505]/90')
    text = text.replace('bg-[#0a0f1a]', 'bg-[#0a0a0a]')
    text = text.replace('bg-[#0a0f1a]/95', 'bg-[#0a0a0a]/95')
    text = text.replace('bg-[#0a0f1a]/60', 'bg-[#0a0a0a]/60')
    
    # Make the main title extra luxurious (Gradient: Silver -> Gold -> Bronze -> Silver)
    # The current is #a7f3d0 0%, #34d399 25%, #10b981 50%, #0d9488 75%, #ffffff 100%
    # We replace the gradient string specifically if needed, but the hex replacements above will already convert it to:
    # #F9F6EE 0%, #F4E087 25%, #D4AF37 50%, #AA8C2C 75%, #ffffff 100%
    # This is a PERFECT Champagne Gold gradient!
    # Enhance shadow glows for luxury (soft, wide, low opacity)
    text = text.replace('shadow-[0_0_20px_rgba(13,148,136,0.4)]', 'shadow-[0_0_30px_rgba(212,175,55,0.25)]')
    
    return text
for filename in ['scan.html', 'scan.js']:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = apply_luxury_theme(content)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Applied Luxury theme to {filename}")
