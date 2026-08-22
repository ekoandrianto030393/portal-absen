import os

def upgrade_colors_in_html(text):
    # 1. Upgrade mainTitle
    old_title_style = 'style="background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 40%, #7dd3fc 60%, #ffffff 100%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 15px rgba(56, 189, 248, 0.4));"'
    new_title_style = 'style="background: linear-gradient(135deg, #ffffff 0%, #a5f3fc 25%, #06b6d4 50%, #3b82f6 75%, #ffffff 100%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 25px rgba(6, 182, 212, 0.8));"'
    text = text.replace(old_title_style, new_title_style)
    
    # 2. Upgrade PUSKESMAS WANA
    old_subtitle_style = 'style="background: linear-gradient(90deg, #e0f2fe 0%, #fde047 50%, #22d3ee 100%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 15px rgba(34, 211, 238, 0.6)); animation: shine 3s linear infinite;"'
    new_subtitle_style = 'style="background: linear-gradient(90deg, #3b82f6 0%, #22d3ee 50%, #06b6d4 100%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 20px rgba(34, 211, 238, 0.8)); animation: shine 3s linear infinite;"'
    text = text.replace(old_subtitle_style, new_subtitle_style)
    
    # 3. Upgrade statusMessage
    old_status = 'style="text-shadow: 0 0 20px rgba(34,211,238,0.6);"'
    new_status = 'style="background: linear-gradient(90deg, #22d3ee 0%, #3b82f6 100%); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 25px rgba(34,211,238,0.8));"'
    text = text.replace(old_status, new_status)
    
    return text


def upgrade_colors_in_js(text):
    text = text.replace("let shadowColor = '#22d3ee';", "let shadowColor = '#06b6d4';")
    text = text.replace("text-cyan-400", "text-cyan-300")
    return text


if os.path.exists('scan.html'):
    with open('scan.html', 'r', encoding='utf-8') as f:
        html = f.read()
    html = upgrade_colors_in_html(html)
    with open('scan.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Upgraded HTML")

if os.path.exists('scan.js'):
    with open('scan.js', 'r', encoding='utf-8') as f:
        js = f.read()
    js = upgrade_colors_in_js(js)
    with open('scan.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print("Upgraded JS")
