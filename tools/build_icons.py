"""
CineMatch icon builder.

Every icon lives in web/icons/<name>.svg. The default set is Phosphor Icons
(https://phosphoricons.com, MIT licence) in the duotone weight, filled weight
for the solid ones. Replace any file with your own SVG; keep the file name.
Any viewBox works; use currentColor so CSS can colour it.

  * python3 tools/build_icons.py            copies the Phosphor set (needs npm install)
  * python3 tools/build_icons.py --weight bold   same, another Phosphor weight
                                              (thin, light, regular, bold, duotone)

  * At runtime the app fetches icons/<name>.svg and uses it, so a replaced
    file shows up as soon as the app is served from a web server.
  * Run   python3 tools/build_icons.py --inline   to also copy the current
    files into the fallback sprite inside index.html (used when the files
    cannot be fetched, e.g. when index.html is opened straight from disk).
  * Run without --inline only on first setup: it (re)creates the default set.

Stroke icons use stroke="currentColor", filled ones fill="currentColor",
so CSS colour applies to both.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, 'web')
ICONS = os.path.join(WEB, 'icons')

S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'
F = 'fill="currentColor" stroke="none"'

STAR = 'M12 3.4l2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.93l-5.3 2.78 1.01-5.9-4.29-4.18 5.93-.86z'
HEART = 'M12 20.3s-7.4-4.5-9.2-9C1.4 7.9 3.5 4.6 6.9 4.6c2 0 3.4 1 4.1 2.3.7-1.3 2.1-2.3 4.1-2.3 3.4 0 5.5 3.3 4.1 6.7-1.8 4.5-7.2 9-7.2 9z'
FLAME = 'M12 2.8c.9 3.3 5.6 5.3 5.6 10.4a5.6 5.6 0 0 1-11.2.3c0-2.3 1.1-3.8 2.3-4.8.1 2 1 3.2 2.2 3.2C10.5 8.7 10 6 12 2.8z'

DEFAULTS = {
    'discover': (S, '<rect x="7.5" y="3" width="12" height="16.5" rx="2.6"/><path d="M4.5 7v10.5a3 3 0 0 0 3 3h8.5"/><path d="M13.5 9.6c.5-.9 2.4-.9 2.4.8 0 1.3-2.4 2.8-2.4 2.8s-2.4-1.5-2.4-2.8c0-1.7 1.9-1.7 2.4-.8z"/>'),
    'friends': (S, '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.6a6 6 0 0 1 12 0"/><path d="M15.4 5.5a3.1 3.1 0 0 1 0 6"/><path d="M17.6 14.3A5.6 5.6 0 0 1 21 19.6"/>'),
    'calendar': (S, '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.6h17M8 3v4M16 3v4"/><path d="m12 12.2 1 2 2.2.3-1.6 1.6.4 2.2-2-1-2 1 .4-2.2-1.6-1.6 2.2-.3z"/>'),
    'profile': (S, '<circle cx="12" cy="8.3" r="3.8"/><path d="M4.6 20.2a7.4 7.4 0 0 1 14.8 0"/>'),
    'search': (S, '<circle cx="10.6" cy="10.6" r="6.6"/><path d="m20 20-4.7-4.7"/>'),
    'heart': (F, f'<path d="{HEART}"/>'),
    'heart-line': (S, f'<path d="{HEART}"/>'),
    'x': (S, '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
    'undo': (S, '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    'info': (S, '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2M12 7.8h.01"/>'),
    'flame': (F, f'<path d="{FLAME}"/>'),
    'flame-line': (S, f'<path d="{FLAME}"/>'),
    'check': (S, '<path d="M5 12.6l4.4 4.4L19 7.4"/>'),
    'star': (S, f'<path d="{STAR}"/>'),
    'star-fill': (F, f'<path d="{STAR}"/>'),
    'sparkle': (F, '<path d="M10 3c.6 4.1 2.6 6.1 6.7 6.7-4.1.6-6.1 2.6-6.7 6.7-.6-4.1-2.6-6.1-6.7-6.7C7.4 9.1 9.4 7.1 10 3z"/><path d="M17.5 13.5c.3 2 1.2 2.9 3.2 3.2-2 .3-2.9 1.2-3.2 3.2-.3-2-1.2-2.9-3.2-3.2 2-.3 2.9-1.2 3.2-3.2z"/>'),
    'plus': (S, '<path d="M12 5v14M5 12h14"/>'),
    'chevron': (S, '<path d="m9.5 6 6 6-6 6"/>'),
    'back': (S, '<path d="m14.5 6-6 6 6 6"/>'),
    'coin': (S, '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="5.4"/><path d="m12 9.6.7 1.4 1.5.2-1.1 1.1.3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1.1 1.5-.2z"/>'),
    'level': (S, '<path d="M12 3l7 3v5.4c0 4.5-3 7.8-7 9.6-4-1.8-7-5.1-7-9.6V6z"/><path d="m8.6 12.8 3.4-3 3.4 3M8.6 16l3.4-3 3.4 3"/>'),
    'send': (S, '<path d="M20.5 3.5 10.6 13.4"/><path d="M20.5 3.5 14.2 20.5l-3.6-7.1-7.1-3.6z"/>'),
    'hourglass': (S, '<path d="M6.5 3h11M6.5 21h11"/><path d="M7.5 3c0 4.5 4.5 6 4.5 9s-4.5 4.5-4.5 9M16.5 3c0 4.5-4.5 6-4.5 9s4.5 4.5 4.5 9"/><path d="M9.6 18.2c.8-.9 1.6-1.4 2.4-1.4s1.6.5 2.4 1.4" fill="currentColor"/>'),
    'inbox': (S, '<path d="M3.5 13.5 6 5.5A2 2 0 0 1 7.9 4h8.2A2 2 0 0 1 18 5.5l2.5 8"/><path d="M3.5 13.5v4A2.5 2.5 0 0 0 6 20h12a2.5 2.5 0 0 0 2.5-2.5v-4h-5a3.5 3.5 0 0 1-7 0z"/>'),
    'reply': (S, '<path d="M10 8.5 5 13l5 4.5"/><path d="M5.5 13H14a5 5 0 0 1 5 5v1"/>'),
    'shield': (S, '<path d="M12 2.8l7.6 3.2v5.6c0 4.9-3.2 8.4-7.6 10.3-4.4-1.9-7.6-5.4-7.6-10.3V6z" fill="currentColor" fill-opacity=".16"/>'),
    'bolt': (F, '<path d="M13.4 2.5 5 13.6h6.1l-1 7.9 8.4-11.1h-6.1z"/>'),
    'popcorn': (S, '<path d="M6 9.5h12l-1.7 10.8H7.7z"/><path d="M10 9.5l.4 10.8M14 9.5l-.4 10.8"/><path d="M6.4 9.5a2.6 2.6 0 0 1 2-4.2 2.9 2.9 0 0 1 3.6-1.6 2.9 2.9 0 0 1 3.6 1.6 2.6 2.6 0 0 1 2 4.2"/>'),
    'google': (S, '<path d="M19.4 12a7.4 7.4 0 1 1-2.2-5.3"/><path d="M12.6 12h6.8"/>'),
    'mail': (S, '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m3.8 7 8.2 6 8.2-6"/>'),
    'logout': (S, '<path d="M14 4h3.8A2.2 2.2 0 0 1 20 6.2v11.6a2.2 2.2 0 0 1-2.2 2.2H14"/><path d="M9.5 16.2 5.3 12l4.2-4.2M5.3 12H15"/>'),
    'ticket': (S, '<path d="M3.8 7.6A1.6 1.6 0 0 1 5.4 6h13.2a1.6 1.6 0 0 1 1.6 1.6V10a2 2 0 0 0 0 4v2.4a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6V14a2 2 0 0 0 0-4z"/><path d="M14.5 6.5v1.6M14.5 11.2v1.6M14.5 15.9v1.6"/>'),
    'film': (S, '<rect x="3.5" y="4.5" width="17" height="15" rx="2.6"/><path d="M7.6 4.5v15M16.4 4.5v15M3.5 9.2h4.1M3.5 14.8h4.1M16.4 9.2h4.1M16.4 14.8h4.1"/>'),
    'tv': (S, '<rect x="3" y="6.5" width="18" height="12.5" rx="2.6"/><path d="m8.6 3 3.4 3.4L15.4 3"/>'),
    'key': (S, '<circle cx="8" cy="15.5" r="4"/><path d="m10.9 12.6 8.6-8.6M16.6 6.5l2.4 2.4M14.2 8.9l1.9 1.9"/>'),
    'copy': (S, '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.4"/><path d="M15.5 8.5V6.4A2.4 2.4 0 0 0 13.1 4H6.4A2.4 2.4 0 0 0 4 6.4v6.7a2.4 2.4 0 0 0 2.4 2.4h2.1"/>'),
    'eye': (S, '<path d="M2.6 12S6 5.6 12 5.6 21.4 12 21.4 12 18 18.4 12 18.4 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.9"/>'),
    'group-plus': (S, '<circle cx="8.5" cy="8.6" r="3.1"/><path d="M3 19.4a5.6 5.6 0 0 1 11 0"/><path d="M14.6 5.8a2.9 2.9 0 0 1 0 5.6"/><path d="M19 13v6M16 16h6"/>'),
    'edit': (S, '<path d="M4 20h4.2L19 9.2a2.1 2.1 0 0 0 0-3L17.8 5a2.1 2.1 0 0 0-3 0L4 15.8z"/><path d="m13.5 6.5 4 4"/>'),
    'trophy': (S, '<path d="M8 4h8v5.5a4 4 0 0 1-8 0z"/><path d="M8 6H4.8v1.4A3.4 3.4 0 0 0 8 10.8M16 6h3.2v1.4a3.4 3.4 0 0 1-3.2 3.4"/><path d="M12 13.5V17M8.5 20h7M10 17h4l.5 3h-5z"/>'),
}


def file_svg(attrs, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {attrs}>{body}</svg>\n'


def write_defaults():
    os.makedirs(ICONS, exist_ok=True)
    for name, (attrs, body) in DEFAULTS.items():
        with open(os.path.join(ICONS, name + '.svg'), 'w') as f:
            f.write(file_svg(attrs, body))
    with open(os.path.join(ICONS, 'app-icon.svg'), 'w') as f:
        f.write(APP_ICON)


APP_ICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#370617"/><stop offset="1" stop-color="#03071E"/></radialGradient>
    <linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DC2F02"/><stop offset="1" stop-color="#9D0208"/></linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="scan" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="3" fill="#000" opacity=".28"/></pattern>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <path d="M0 380 C90 340 170 420 256 380 S420 340 512 370" fill="none" stroke="#6A040F" stroke-width="8"/>
  <path d="M0 410 C100 380 180 450 270 412 S430 380 512 400" fill="none" stroke="#9D0208" stroke-width="5" opacity=".8"/>
  <g filter="url(#glow)">
    <path d="M256 330s-118-72-146-142c-22-55 12-108 66-108 32 0 55 16 66 37 11-21 34-37 66-37 54 0 88 53 66 108-28 70-118 142-118 142z" fill="url(#h)"/>
  </g>
  <rect x="196" y="150" width="120" height="86" rx="14" fill="#03071E"/>
  <path d="M244 172 L282 193 L244 214Z" fill="#DC2F02"/>
  <rect width="512" height="512" fill="url(#scan)"/>
</svg>
'''


def read_icons():
    out = {}
    for fn in sorted(os.listdir(ICONS)):
        if not fn.endswith('.svg') or fn.startswith('app-icon'):
            continue
        src = open(os.path.join(ICONS, fn)).read()
        m = re.search(r'<svg([^>]*)>(.*)</svg>', src, re.S)
        attrs = re.sub(r'\s(xmlns|width|height)="[^"]*"', '', m.group(1))
        vb = re.search(r'viewBox="([^"]*)"', attrs)
        attrs = re.sub(r'\sviewBox="[^"]*"', '', attrs).strip()
        out[fn[:-4]] = (vb.group(1) if vb else '0 0 24 24', attrs, m.group(2).strip())
    return out


def inline():
    icons = read_icons()
    sprite = '<svg id="sprite" xmlns="http://www.w3.org/2000/svg" style="display:none">' + ''.join(
        f'<symbol id="i-{n}" viewBox="{vb}"><g {a}>{b}</g></symbol>' for n, (vb, a, b) in icons.items()) + '</svg>'
    idx = os.path.join(WEB, 'index.html')
    html = open(idx).read()
    html = re.sub(r'<!--SPRITE-->.*?<!--/SPRITE-->', '<!--SPRITE-->' + sprite + '<!--/SPRITE-->', html, flags=re.S)
    open(idx, 'w').write(html)
    with open(os.path.join(ICONS, 'manifest.json'), 'w') as f:
        f.write('[' + ','.join(f'"{n}"' for n in icons) + ']\n')
    print(f'inlined {len(icons)} icons')


PHOSPHOR = {
    'discover': 'cards', 'friends': 'users-three', 'calendar': 'calendar-star', 'profile': 'user-circle',
    'search': 'magnifying-glass', 'heart': ('heart', 'fill'), 'heart-line': 'heart', 'x': 'x',
    'undo': 'arrow-u-up-left', 'info': 'info', 'flame': ('fire', 'fill'), 'flame-line': 'fire', 'check': 'check',
    'star': 'star', 'star-fill': ('star', 'fill'), 'sparkle': 'sparkle', 'plus': 'plus', 'chevron': 'caret-right',
    'back': 'caret-left', 'coin': 'coin', 'level': 'shield-chevron', 'bolt': ('lightning', 'fill'), 'popcorn': 'popcorn',
    'mail': 'envelope-simple', 'logout': 'sign-out', 'ticket': 'ticket', 'film': 'film-strip', 'tv': 'television-simple',
    'key': 'key', 'copy': 'copy', 'eye': 'eye', 'group-plus': 'film-slate', 'edit': 'pencil-simple', 'trophy': 'trophy',
    'shield': 'shield', 'send': 'paper-plane-tilt', 'hourglass': 'hourglass-medium', 'inbox': 'tray',
    'reply': 'arrow-bend-up-left', 'hand': 'hand-swipe-right', 'sun': 'sun', 'moon': 'moon', 'monitor': 'monitor',
    'crt': 'television', 'gear': 'gear-six', 'camera': 'camera', 'user': 'user', 'sound': 'speaker-high',
}


def copy_phosphor(weight='duotone'):
    src = os.path.join(ROOT, 'node_modules', '@phosphor-icons', 'core', 'assets')
    if not os.path.isdir(src):
        sys.exit('Run npm install first (needs @phosphor-icons/core).')
    os.makedirs(ICONS, exist_ok=True)
    for name, spec in PHOSPHOR.items():
        ph, w = spec if isinstance(spec, tuple) else (spec, weight)
        fn = f'{ph}.svg' if w == 'regular' else f'{ph}-{w}.svg'
        svg = open(os.path.join(src, w, fn)).read()
        with open(os.path.join(ICONS, name + '.svg'), 'w') as f:
            f.write(svg.strip() + '\n')
    # the sign-in glyph stays a neutral custom "G", not a brand logo
    attrs, body = DEFAULTS['google']
    with open(os.path.join(ICONS, 'google.svg'), 'w') as f:
        f.write(file_svg(attrs, body))
    with open(os.path.join(ICONS, 'app-icon.svg'), 'w') as f:
        f.write(APP_ICON)
    with open(os.path.join(ICONS, 'LICENSE-phosphor.txt'), 'w') as f:
        f.write(open(os.path.join(ROOT, 'node_modules', '@phosphor-icons', 'core', 'LICENSE')).read())


if __name__ == '__main__':
    if '--legacy' in sys.argv:
        write_defaults()
    elif '--inline' not in sys.argv:
        w = sys.argv[sys.argv.index('--weight') + 1] if '--weight' in sys.argv else 'duotone'
        copy_phosphor(w)
    inline()
