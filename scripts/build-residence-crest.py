"""Replace the passport globe with a Peanut coat of arms; retain document motion."""
import json
from pathlib import Path

ASSET = Path(__file__).resolve().parents[1] / 'src/assets/onboarding/documents.json'
INK = [0, 0, 0, 1]
# Mascot detail weight: about 2.8 px at the passport's on-screen scale.
LINE = 3.03
GOLD = [252 / 255, 200 / 255, 20 / 255, 1]
WHITE = [1, 1, 1, 1]


def transform(position=(0, 0), rotation=0):
    return {'ty': 'tr', 'p': {'a': 0, 'k': list(position)}, 'a': {'a': 0, 'k': [0, 0]},
            's': {'a': 0, 'k': [100, 100]}, 'r': {'a': 0, 'k': rotation}, 'o': {'a': 0, 'k': 100}}


def stroke(width=LINE):
    return {'ty': 'st', 'c': {'a': 0, 'k': INK}, 'o': {'a': 0, 'k': 100},
            'w': {'a': 0, 'k': width}, 'lc': 2, 'lj': 2}


def path(vertices, incoming=None, outgoing=None, closed=False):
    zeros = [[0, 0] for _ in vertices]
    return {'ty': 'sh', 'ks': {'a': 0, 'k': {'v': vertices, 'i': incoming or zeros,
            'o': outgoing or zeros, 'c': closed}}}


def group(name, shapes, fill=None, width=LINE, position=(0, 0), rotation=0):
    # The stroke is listed before the fill so the whole outline paints on top of it.
    items = list(shapes) + [stroke(width)]
    if fill:
        items.append({'ty': 'fl', 'c': {'a': 0, 'k': fill}, 'o': {'a': 0, 'k': 100}, 'r': 1})
    return {'ty': 'gr', 'nm': name, 'it': items + [transform(position, rotation)]}


# The shell's two lobes and short texture strokes stay clear at passport scale.
shell = path([[0, -69], [19, -53], [13, -36], [20, -18], [0, -2],
              [-20, -18], [-13, -36], [-19, -53]],
             [[-12, 0], [0, -12], [0, -6], [0, -9], [12, 0], [0, 10], [0, 6], [0, 8]],
             [[12, 0], [0, 8], [0, 6], [0, 10], [-12, 0], [0, -9], [0, -6], [0, -12]], True)
texture = [path([[0, -61], [0, -10]]),
           path([[-8, -55], [-10, -50]]), path([[8, -55], [10, -50]]),
           path([[-7, -24], [-10, -18]]), path([[7, -24], [10, -18]])]
shield = path([[-34, -73], [34, -73], [33, -30], [27, -1], [0, 17], [-27, -1], [-33, -30]],
              [[0, 0], [0, 0], [0, -12], [5, -8], [12, -6], [7, 5], [0, 12]],
              [[0, 0], [0, 12], [0, 12], [-7, 5], [-12, -6], [-5, -8], [0, -12]], True)
crown = path([[-25, -81], [-29, -96], [-13, -87], [0, -102], [13, -87], [29, -96], [25, -81]], closed=True)

leaves = []
branches = []
for side in [-1, 1]:
    branches.append(group('Laurel branch', [path([[side * 45, -74], [side * 52, -38], [side * 29, 19]],
                           [[0, 0], [0, -19], [side * 15, -8]],
                           [[side * 9, 13], [0, 19], [0, 0]])]))
    for index, (x, y) in enumerate([(49, -64), (55, -46), (54, -27), (46, -8)]):
        leaves.append(group('Laurel leaf', [{'ty': 'el', 'p': {'a': 0, 'k': [0, 0]},
                     's': {'a': 0, 'k': [9, 17]}, 'd': 1}], fill=GOLD,
                     position=(side * x, y), rotation=side * (-35 + index * 10)))

# Lottie paints earlier groups above later groups.
crest = {'ty': 'gr', 'nm': 'Peanut coat of arms', 'it': [
    group('Peanut shell texture', texture),
    group('Peanut shell', [shell], fill=GOLD),
    group('Crest crown', [crown], fill=GOLD),
    group('Heraldic shield', [shield], fill=WHITE),
    *leaves, *branches, transform()
]}

data = json.loads(ASSET.read_text())
passport = next(layer for layer in data['layers'] if layer['nm'] == 'Passport')
items = passport['shapes'][0]['it']
# Support both the original globe and repeated builds of this crest.
cover = next(item for item in items if item.get('ty') == 'gr'
             and any(shape.get('ty') == 'rc' for shape in item.get('it', [])))
passport['shapes'][0]['it'] = items[:2] + [crest, cover, items[-1]]
ASSET.write_text(json.dumps(data, separators=(',', ':')) + '\n')
