from pathlib import Path
text = Path('client/src/pages/Chat.jsx').read_text(encoding='utf-8')
start = text.find('// Load lists (groups, DMs, people)')
print('start', start)
idx = text.find('// For', start)
print('nextFor', idx, text[idx:idx+30])

