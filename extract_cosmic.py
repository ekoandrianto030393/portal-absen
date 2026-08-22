import json

log_file = r'C:\Users\hi\.gemini\antigravity\brain\55b006dc-c1ba-4e13-82d7-3028864212b6\.system_generated\logs\transcript.jsonl'
output_file = 'apply_cosmic_theme.py'

found = False
for line in open(log_file, 'r', encoding='utf-8'):
    if 'apply_cosmic_theme.py' in line and 'write_to_file' in line:
        try:
            data = json.loads(line)
            tool_calls = data.get('tool_calls', [])
            for call in tool_calls:
                if call.get('name') == 'write_to_file' and 'apply_cosmic_theme.py' in call.get('args', {}).get('TargetFile', ''):
                    code = call['args']['CodeContent']
                    code = code.strip('"')
                    code = code.encode('utf-8').decode('unicode_escape')
                    with open(output_file, 'w', encoding='utf-8') as f:
                        f.write(code)
                    print(f"Extracted to {output_file}")
                    found = True
                    break
            if found:
                break
        except Exception as e:
            pass
