import re

with open('scan.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Define the regex pattern for the dl-panel
dl_panel_pattern = re.compile(r'<!-- \[NEW\] PANEL KHUSUS DINAS LUAR.*?</div>\s*</div>\s*</div>', re.DOTALL)

dl_match = dl_panel_pattern.search(html)
if dl_match:
    dl_panel_html = dl_match.group(0)
    
    # Remove dl_panel from its original location
    html = html.replace(dl_panel_html, '')
    
    # Find the end of DAFTAR HADIR panel
    # We will search for 'MEMUAT DATA KEHADIRAN...</div>\n                        </div>\n                    </div>\n                </div>'
    target_pattern = r'(MEMUAT DATA KEHADIRAN...</div>\s*</div>\s*</div>\s*</div>)'
    
    if re.search(target_pattern, html):
        # Insert dl_panel right after DAFTAR HADIR panel
        html = re.sub(target_pattern, r'\1\n\n                ' + dl_panel_html, html)
        print("Moved dl-panel to the right column successfully.")
    else:
        print("Could not find the target location for DAFTAR HADIR.")
else:
    print("Could not find dl-panel in the HTML.")

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(html)
