from pathlib import Path

p = Path("src/lib/discovery.ts")
s = p.read_text()
old = 'return unique(CATEGORY_DEFINITIONS.flatMap((definition) => definition.selectors)).slice(0, 24);'
new = 'return unique(CATEGORY_DEFINITIONS.flatMap((definition) => definition.selectors)).slice(0, 36);'
if old not in s:
    raise SystemExit("regional selector cap anchor missing")
p.write_text(s.replace(old, new, 1))
