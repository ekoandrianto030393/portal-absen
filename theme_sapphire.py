import os

def apply_theme(text):
    # Background Hex (Dark Emerald -> Slate 900)
    text = text.replace('#065f46', '#0f172a') 
    text = text.replace('#022c22', '#0f172a')
    
    # Accents Hex (Gold/Amber -> Cyan/Cerulean)
    text = text.replace('#FFD700', '#22D3EE')
    text = text.replace('#FBBF24', '#22D3EE')
    text = text.replace('#F59E0B', '#06B6D4')
    
    # Specific RGBA replacements for Glows and Gradients
    text = text.replace('rgba(255,215,0', 'rgba(34,211,238')
    text = text.replace('rgba(255, 215, 0', 'rgba(34, 211, 238')
    text = text.replace('rgba(251,191,36', 'rgba(34,211,238')
    text = text.replace('rgba(251, 191, 36', 'rgba(34, 211, 238')
    
    # Emerald RGBA -> Sky/Cyan RGBA
    text = text.replace('rgba(16,185,129', 'rgba(56,189,248')
    text = text.replace('rgba(16, 185, 129', 'rgba(56, 189, 248')
    
    # Old Dark Emerald RGBA -> Slate 900 RGBA
    text = text.replace('rgba(2, 44, 34', 'rgba(15, 23, 42')
    text = text.replace('rgba(2,44,34', 'rgba(15,23,42')

    # Tailwind Emerald -> Slate/Cyan/Sky
    text = text.replace('emerald-950', 'slate-900')
    text = text.replace('emerald-900', 'slate-800')
    text = text.replace('emerald-800', 'slate-900')
    text = text.replace('emerald-600', 'cyan-600')
    text = text.replace('emerald-500', 'cyan-500')
    text = text.replace('emerald-400', 'cyan-400')
    text = text.replace('emerald-300', 'sky-300')
    text = text.replace('emerald-200', 'sky-200')
    text = text.replace('emerald-100', 'slate-200')
    text = text.replace('emerald-50', 'slate-100')

    # Tailwind Amber -> Cyan/Slate
    text = text.replace('amber-950', 'cyan-950')
    text = text.replace('amber-900', 'cyan-900')
    text = text.replace('amber-600', 'cyan-600')
    text = text.replace('amber-500', 'cyan-500')
    text = text.replace('amber-400', 'cyan-400')
    text = text.replace('amber-300', 'cyan-300')
    text = text.replace('amber-200', 'slate-300')
    text = text.replace('amber-100', 'slate-200')
    
    # Other Colors
    text = text.replace('yellow-400', 'cyan-400')
    text = text.replace('text-green-500', 'text-cyan-400')
    text = text.replace('border-green-500', 'border-cyan-400')
    text = text.replace('bg-green-500', 'bg-cyan-500')
    text = text.replace('#00FF00', '#00FFFF')

    return text

for filename in ['scan.html', 'scan.js']:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = apply_theme(content)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Applied Sapphire & Ice theme to {filename}")

