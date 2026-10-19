"""Check repository Markdown file links; external URLs and anchors are excluded."""
import re
from pathlib import Path
from urllib.parse import unquote

root = Path(__file__).resolve().parent.parent
files = [root / "README.md", *sorted((root / "docs").rglob("*.md")),
         *sorted((root / "frontend").glob("*.md")), *sorted((root / "backend").glob("*.md"))]
failures = []
count = 0
for file in files:
    for target in re.findall(r"\]\(([^)]+)\)", file.read_text()):
        if "://" in target or target.startswith(("#", "mailto:")):
            continue
        path = unquote(target.split("#", 1)[0].strip("<>"))
        if not path:
            continue
        count += 1
        if not (file.parent / path).exists():
            failures.append(f"{file.relative_to(root)}: {target}")
if failures:
    raise SystemExit("\n".join(failures))
print(f"OK: {len(files)} Markdown files, {count} local links.")
