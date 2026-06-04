import os
import re

def revert_theme(text):
    # Lighter Emerald background (was #0f172a, originally #065f46)
    # The user wanted a slightly lighter emerald green than before. We use #047857 (emerald-700) or #059669 (emerald-600).
    # Let's use #047857 (emerald-700) which is elegant and lighter than 800.
    text = text.replace('#0f172a', '#047857') 
    text = text.replace('rgba(15, 23, 42', 'rgba(4, 120, 87')
    text = text.replace('rgba(15,23,42', 'rgba(4,120,87')

    # Accents Cyan -> Gold/Amber
    text = text.replace('#22D3EE', '#FFD700')
    text = text.replace('#06B6D4', '#F59E0B')
    text = text.replace('#00FFFF', '#00FF00')
    text = text.replace('rgba(34,211,238', 'rgba(255,215,0')
    text = text.replace('rgba(34, 211, 238', 'rgba(255, 215, 0')

    # Sky -> Emerald
    text = text.replace('rgba(56,189,248', 'rgba(16,185,129')
    text = text.replace('rgba(56, 189, 248', 'rgba(16, 185, 129')

    # Tailwind Classes Backgrounds
    text = re.sub(r'slate-900', 'emerald-700', text)
    text = re.sub(r'slate-800', 'emerald-600', text)

    # Tailwind Text Sky -> Emerald
    text = re.sub(r'sky-300', 'emerald-300', text)
    text = re.sub(r'sky-200', 'emerald-200', text)
    
    # Tailwind Slate Text -> Amber/Emerald
    text = re.sub(r'text-slate-100', 'text-emerald-50', text)
    text = re.sub(r'text-slate-200', 'text-amber-100', text)
    text = re.sub(r'text-slate-300', 'text-amber-200', text)

    # Tailwind Cyan -> Amber (Borders, Bg, Shadows)
    text = re.sub(r'border-cyan-400', 'border-amber-400', text)
    text = re.sub(r'border-cyan-500', 'border-amber-500', text)
    text = re.sub(r'bg-cyan-500', 'bg-amber-500', text)
    text = re.sub(r'bg-cyan-600', 'bg-amber-600', text)
    
    text = re.sub(r'text-cyan-600', 'text-emerald-600', text)
    text = re.sub(r'text-cyan-500', 'text-emerald-500', text)
    text = re.sub(r'text-cyan-400', 'text-amber-400', text)
    text = re.sub(r'text-cyan-300', 'text-amber-300', text)
    text = re.sub(r'text-cyan-950', 'text-amber-950', text)
    
    text = re.sub(r'via-cyan-400', 'via-amber-400', text)
    text = re.sub(r'from-cyan-400', 'from-amber-400', text)
    text = re.sub(r'to-cyan-400', 'to-amber-400', text)

    return text

for filename in ['scan.html', 'scan.js']:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = revert_theme(content)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Reverted theme to Emerald & Gold (Lighter) for {filename}")
