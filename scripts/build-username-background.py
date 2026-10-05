"""Build the requested slow @ background from mono #255's vector atsign artwork.

No fonts, bitmaps or external assets. Four signs stay outside the central mascot.
Run from peanut-ui's root to regenerate src/assets/onboarding/username-at.json.
"""
import json
from pathlib import Path


def prop(value):
    return {"a": 0, "k": value}


def motion(values):
    return {"a": 1, "k": [
        {"t": frame, "s": value, "i": {"x": [0.65], "y": [1]}, "o": {"x": [0.35], "y": [0]}}
        for frame, value in values
    ]}


# Cubic outer @ path from mono #255; the inner oval makes the counter explicit.
at_path = {"v": [[12,-10],[12,10],[28,15],[37,-4],[0,-38],[-37,-4],[-28,29],[17,34]],
           "i": [[0,0],[0,0],[-8,3],[0,12],[20,0],[0,-20],[-7,-12],[-15,5]],
           "o": [[0,0],[0,8],[8,-3],[0,-20],[-20,0],[0,15],[12,10],[0,0]], "c": False}
ink = [22 / 255, 22 / 255, 22 / 255, 1]
pink = [1, 144 / 255, 232 / 255, 1]
transform = {"ty": "tr", "p": prop([0,0]), "a": prop([0,0]), "s": prop([100,100]), "r": prop(0), "o": prop(100)}
stroke = {"ty": "st", "c": prop(ink), "o": prop(100), "w": prop(4), "lc": 2, "lj": 2}
shapes = [
    {"ty": "gr", "it": [
        {"ty": "el", "p": prop([0,0]), "s": prop([28,36]), "d": 1},
        {"ty": "fl", "c": prop(pink), "o": prop(100), "r": 1}, stroke, transform]},
    {"ty": "gr", "it": [{"ty": "sh", "ks": prop(at_path)}, stroke, transform]},
]
# 20-second seamless loop; only 12px of travel at a 390px mobile viewport.
placements = [(150,330,28,-30,-8), (900,405,-25,34,7), (155,780,24,28,6), (880,825,-26,-30,-7)]
layers = []
for index, (x,y,dx,dy,rotation) in enumerate(placements):
    layers.append({"ty": 4, "nm": "Floating @ " + str(index + 1), "ind": index + 1,
                   "ddd": 0, "sr": 1, "ip": 0, "op": 600, "st": 0,
                   "ks": {"p": motion([(0,[x,y,0]), (300,[x+dx,y+dy,0]), (600,[x,y,0])]),
                          "a": prop([0,0,0]), "s": prop([150,150,100]),
                          "r": motion([(0,[rotation]), (300,[-rotation]), (600,[rotation])]), "o": prop(70)},
                   "shapes": shapes})
asset = {"v": "5.13.0", "fr": 30, "ip": 0, "op": 600, "w": 1050, "h": 1000,
         "nm": "Peanut username — floating @ signs", "ddd": 0, "assets": [], "layers": layers, "markers": []}
Path('src/assets/onboarding/username-at.json').write_text(json.dumps(asset, separators=(',', ':')) + '\n')
