from pathlib import Path
lines = Path('src/App.jsx').read_text(encoding='utf-8').splitlines()
for i in range(120, 160):
    print(f"{i+1}: {lines[i]}")
