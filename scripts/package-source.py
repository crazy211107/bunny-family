"""Package only project sources and compiled assets; never include credentials or private config."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parent.parent
output = root / 'output' / '兔兔小窝-首页工作台与豆伴AI-20261029.zip'
output.parent.mkdir(exist_ok=True)
files = []
for directory in ('src', 'public', 'miniprogram', 'docs', 'scripts', 'server', 'dist'):
    files.extend(path for path in (root / directory).rglob('*') if path.is_file() and not path.is_symlink())
for name in ('README.md', 'package.json', 'package-lock.json', 'project.config.json', 'index.html', 'start-preview.cmd', '.gitignore', 'tailwind.config.cjs', 'postcss.config.cjs', 'tsconfig.json'):
    path = root / name
    if path.is_file():
        files.append(path)

def allowed(path):
    relative = path.relative_to(root)
    if any(part in ('node_modules', '.git', '__pycache__', 'output', '.workbuddy') for part in relative.parts):
        return False
    if path.name.startswith('.env') and path.name != '.env.example':
        return False
    return path.name != 'project.private.config.json' and path.suffix not in ('.log', '.pyc')

included = sorted(set(path for path in files if allowed(path)))
with ZipFile(output, 'w', ZIP_DEFLATED, compresslevel=6) as archive:
    for path in included:
        archive.write(path, 'bunny-family/' + path.relative_to(root).as_posix())
with ZipFile(output) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert 'bunny-family/src/pages/CareWorkspace.tsx' in names
    assert 'bunny-family/miniprogram/components/ai-assistant/index.wxss' in names
    assert not any('/.env' in name and not name.endswith('/.env.example') for name in names)
    assert not any(name.endswith('/project.private.config.json') for name in names)
print(json.dumps({'archive': str(output), 'files': len(included), 'bytes': output.stat().st_size, 'credentials': 'excluded'}, ensure_ascii=False))
