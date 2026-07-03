import os

def apply_theme(text):
    # --- BODY & BACKGROUND (Ivory -> Midnight Navy) ---
    text = text.replace('#FAF6ED', '#0A1128') # Deep Navy background
    text = text.replace('rgba(6, 78, 59', 'rgba(10, 17, 40') # Emerald hint -> Navy hint
    text = text.replace('color: #064E3B', 'color: #D4AF37') # Main text Emerald -> Gold

    # --- PANELS (Dark Emerald -> Slate/Midnight) ---
    text = text.replace('#064E3B', '#111827') # Deep Emerald -> Gray 900
    text = text.replace('#022C22', '#030712') # Very Dark Emerald -> Gray 950
    text = text.replace('rgba(2, 44, 34', 'rgba(3, 7, 18') # Emerald shadow -> Slate shadow

    # --- ACCENTS (Keep Gold, but make it True Luxury Gold) ---
    text = text.replace('#D2A45D', '#D4AF37') # Standard Gold -> Metallic True Gold
    text = text.replace('#FEF3C7', '#FDFBF7') # Cream -> Stark Crisp Ivory for text contrast
    
    # scan.js JS specific replacements
    text = text.replace("faceColor = '#10B981'", "faceColor = '#D4AF37'") # Success color to Gold
    text = text.replace("'#10b981'", "'#D4AF37'")
    text = text.replace("'#10B981'", "'#D4AF37'")

    return text

for filename in ['scan.html', 'scan.js']:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = apply_theme(content)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Applied Navy & Gold theme to {filename}")
