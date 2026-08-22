import os
import re

def apply_cosmic_theme(text):
    # Primary (#D4AF37) -> Platinum / Soft Ice Blue (#e0f2fe)
    text = text.replace('#D4AF37', '#e0f2fe')
    text = text.replace('rgba(212,175,55,', 'rgba(224,242,254,')
    text = text.replace('rgba(212, 175, 55,', 'rgba(224, 242, 254,')
    
    # Secondary (#AA8C2C) -> Sapphire Blue (#3b82f6)
    text = text.replace('#AA8C2C', '#3b82f6')
    text = text.replace('rgba(170,140,44,', 'rgba(59,130,246,')
    text = text.replace('rgba(170, 140, 44,', 'rgba(59, 130, 246,')
    
    # Dark Accents (#806921) -> Deep Violet (#6d28d9)
    text = text.replace('#806921', '#6d28d9')
    
    # Bright Highlights / Lasers (#F4E087) -> Electric Cyan (#22d3ee)
    text = text.replace('#F4E087', '#22d3ee')
    text = text.replace('rgba(244, 224, 135,', 'rgba(34, 211, 238,')
    text = text.replace('rgba(244,224,135,', 'rgba(34,211,238,')
    
    # Extreme Brights (#F9F6EE) -> Pure White
    text = text.replace('#F9F6EE', '#ffffff')

    text = text.replace('bg-[#000000]', 'bg-white/5 backdrop-blur-[30px]')
    text = text.replace('bg-[#050505]/90', 'bg-white/5 backdrop-blur-[40px]')
    text = text.replace('bg-gray-900/90', 'bg-black/40 backdrop-blur-[40px]')
    text = text.replace('bg-black/90', 'bg-black/60 backdrop-blur-md')
    
    # Replace the body CSS completely
    old_body_regex = r"/\* === ULTRA-LUXURY OBSIDIAN & CHAMPAGNE GALAXY BACKGROUND === \*/.*?overflow: hidden;\n    }"
    
    new_body_css = r"""/* === COSMIC GLASSMORPHISM (VISION OS STYLE) === */
    body {
        font-family: 'Outfit', sans-serif;
        background-color: #000000;
        background-image:
            /* Electric Cyan aura top-left */
            radial-gradient(ellipse 80% 80% at 0% -20%, rgba(34, 211, 238, 0.15) 0%, transparent 60%),
            /* Deep Violet/Amethyst glow bottom-right */
            radial-gradient(ellipse 90% 90% at 100% 120%, rgba(109, 40, 217, 0.25) 0%, transparent 70%),
            /* Sapphire Blue core ambient */
            radial-gradient(ellipse 60% 60% at 50% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 80%),
            /* Rose Gold subtle accent top-right */
            radial-gradient(ellipse 40% 40% at 90% 10%, rgba(244, 63, 94, 0.08) 0%, transparent 60%),
            /* Jet Black Base */
            linear-gradient(180deg, #020202 0%, #050505 100%);
        color: #ffffff;
        margin: 0;
        overflow: hidden;
    }
    
    /* Enhance Glass Panels */
    .dark-panel-card {
        background: rgba(255, 255, 255, 0.03) !important;
        backdrop-filter: blur(40px) saturate(150%);
        -webkit-backdrop-filter: blur(40px) saturate(150%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
    }
    
    /* Make typography stark and glowing */
    .text-metallic-gold {
        background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 40%, #7dd3fc 60%, #ffffff 100%);
        background-size: 200% auto;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
        filter: drop-shadow(0 0 15px rgba(56, 189, 248, 0.4));
    }
    
    .data-row {
        background: rgba(255, 255, 255, 0.02) !important;
        border: 1px solid rgba(255, 255, 255, 0.05) !important;
    }
    .data-row::before {
        background: linear-gradient(to bottom, #22d3ee, #3b82f6, #6d28d9) !important;
        box-shadow: 0 0 10px rgba(34, 211, 238, 0.5) !important;
    }
    """
    
    text = re.sub(old_body_regex, new_body_css, text, flags=re.DOTALL)
    
    return text

for filename in ['scan.html', 'scan.js']:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = apply_cosmic_theme(content)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Applied Cosmic theme to {filename}")