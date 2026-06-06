import os

def apply_champagne_theme(text):
    # Add Tailwind config for 'champagne' color if not present
    tailwind_config = """<script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        champagne: {
                            50: '#fdfbf7',
                            100: '#fbf7ed',
                            200: '#f4ebd3',
                            300: '#ead7af',
                            400: '#ddbc82',
                            500: '#d2a45d',
                            600: '#c58b45',
                            700: '#a56c36',
                            800: '#855731',
                            900: '#6c482b',
                            950: '#3a2414',
                        }
                    }
                }
            }
        }
    </script>"""
    
    # Replace the tailwindcss script tag with the configured one
    if '<script src="https://cdn.tailwindcss.com"></script>' in text and 'tailwind.config' not in text:
        text = text.replace('<script src="https://cdn.tailwindcss.com"></script>', tailwind_config)

    # 1. Replace Hex and RGBA
    # amber-500: #f59e0b -> champagne-500: #d2a45d
    text = text.replace('#f59e0b', '#d2a45d')
    text = text.replace('rgba(245, 158, 11', 'rgba(210, 164, 93')
    text = text.replace('rgba(245,158,11', 'rgba(210,164,93')
    
    # amber-400: #fbbf24 -> champagne-400: #ddbc82
    text = text.replace('#fbbf24', '#ddbc82')
    text = text.replace('rgba(251, 191, 36', 'rgba(221, 188, 130')
    text = text.replace('rgba(251,191,36', 'rgba(221,188,130')
    
    # amber-600: #d97706 -> champagne-600: #c58b45
    text = text.replace('#d97706', '#c58b45')
    
    # 2. Refine Background Emerald slightly darker
    # #011f18 (Ultra-deep emerald) -> #01140f (Even deeper emerald, almost obsidian-green)
    text = text.replace('#011f18', '#01140f')
    
    # 3. Replace Tailwind amber-* classes with champagne-*
    for weight in ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']:
        text = text.replace(f'amber-{weight}', f'champagne-{weight}')

    # 4. Refine glowing shadows (reduce opacity to make it more elegant)
    text = text.replace('shadow-[0_0_50px_rgba(245,158,11,0.15)]', 'shadow-[0_0_40px_rgba(210,164,93,0.1)]')
    text = text.replace('shadow-[0_0_30px_rgba(245,158,11,0.2)]', 'shadow-[0_0_20px_rgba(210,164,93,0.15)]')
    text = text.replace('shadow-[0_0_25px_rgba(245,158,11,0.6)]', 'shadow-[0_0_20px_rgba(210,164,93,0.4)]')
    
    return text

for filename in ['scan.html', 'scan.js']:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = apply_champagne_theme(content)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Applied Refined Emerald & Champagne theme to {filename}")
