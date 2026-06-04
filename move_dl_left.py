import re

with open('scan.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Define the regex pattern for the dl-panel
dl_panel_pattern = re.compile(r'<!-- \[NEW\] PANEL KHUSUS DINAS LUAR.*?</div>\s*</div>', re.DOTALL)

# Wait, the structure of dl-panel ends with </div></div>, but let's be more precise:
#     <div class="roster-ticker-container h-40 relative z-10">
#         <div id="dlRoster" class="pr-1 text-emerald-50"></div>
#     </div>
# </div>
dl_panel_pattern = re.compile(r'<!-- \[NEW\] PANEL KHUSUS DINAS LUAR.*?<div id="dlRoster".*?</div>\s*</div>\s*</div>', re.DOTALL)

dl_match = dl_panel_pattern.search(html)
if dl_match:
    dl_panel_html = dl_match.group(0)
    
    # Remove dl_panel from its original location
    html = html.replace(dl_panel_html, '')
    
    # Find the end of cuti-panel
    # We will search for '<div id="cutiRoster" class="pr-1 text-emerald-50"></div>\n    </div>\n</div>'
    cuti_pattern = r'(<div id="cutiRoster"[^>]*></div>\s*</div>\s*</div>)'
    
    if re.search(cuti_pattern, html):
        # Insert dl_panel right after cuti-panel
        html = re.sub(cuti_pattern, r'\1\n\n' + dl_panel_html, html)
        print("Moved dl-panel back to the left column successfully.")
    else:
        print("Could not find the target location for cuti-panel.")
else:
    print("Could not find dl-panel in the HTML.")

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(html)
