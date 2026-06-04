import os
import re

def update_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Emerald green lighter:
    content = content.replace('#022c22', '#065f46')
    content = content.replace('emerald-950', 'emerald-800')
    content = content.replace('emerald-900', 'emerald-700')
    
    # 2. Make gold borders shinier in HTML/JS:
    # Replace amber-500 with amber-400 for brighter gold
    content = content.replace('border-amber-500', 'border-amber-400')
    
    # Replace rgba(251,191,36) with rgba(255,215,0) (Brighter Gold)
    content = content.replace('rgba(251,191,36', 'rgba(255,215,0')
    content = content.replace('rgba(251, 191, 36', 'rgba(255, 215, 0')
    
    # Increase shadow opacity/size
    content = content.replace('border border-amber-400/30', 'border-2 border-amber-400/80 shadow-[0_0_20px_rgba(255,215,0,0.6)]')
    content = content.replace('border border-amber-400/20', 'border border-amber-400/50 shadow-[0_0_15px_rgba(255,215,0,0.5)]')
    
    # JS specific Canvas gold
    content = content.replace('#FBBF24', '#FFD700')
    
    # Make glowing rings even shinier in HTML
    content = content.replace('border-[2px] border-amber-400 shadow-[0_0_20px_rgba(255,215,0,0.6)]', 'border-[3px] border-amber-400 shadow-[0_0_30px_rgba(255,215,0,0.8),inset_0_0_15px_rgba(255,215,0,0.6)]')

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {filename}")

update_file('scan.html')
update_file('scan.js')
