# R7: Ascent's full climb, from the workshop floor to the brass ring in orbit, built from scratch and exported as one .glb per
# zone: src/game/ascent/assets/zone-1.glb ... zone-5.glb (docs/ASCENT.md, "Phase 3: The full climb").
#
#   blender -b --factory-startup -P tools/ascent/build_climb.py              # the five .glb files
#   blender -b --factory-startup -P tools/ascent/build_climb.py -- --preview # and stills in tools/ascent/out/
#
# The route is one walk upward, laid out by a seeded generator (the same Blender gives the same files): each step is placed
# from the last by a rise and a gap drawn from the zone's ranges, kept inside the jump's reach (the numbers below mirror
# src/game/ascent/config.ts; level.vitest.ts checks the result against the game's own), turning round the zone's middle, and
# moved until nothing is in its way or above it. Every zone adds one new kind of step:
#
#   1 workshop       giant books, toolboxes, chips and floppies, round a stack of hardware   static jumps
#   2 server stack   rack units, heat sinks and cable trays round a column of racks          fans that blow you up
#   3 cloud          soft data blocks (drives, sleds, memory modules) over a sea of clouds   blocks that drift
#   4 upper air      solar panels, girders and satellites round an antenna mast              plates that crumble, thin beams
#   5 orbit          asteroids rising to the brass ring                                      drifts, crumbles, beams; the ring
#
# The look (docs/ASCENT.md, "How it looks", the author's new art style of 2026-10-27): lit, shaded and coloured. Every
# mesh has a material from PALETTE below (a base colour, how rough and how metallic it is, and a glow for lights and
# screens); the game draws the materials as they are in the file. Each zone has its own sky, sun and fog (LOOKS, written to
# climb.json). Meshes named SKY_... are the sky's (the Earth, the Moon, the stars, the ringed planet, the station and the ship):
# far away, never fogged.
#
# The contract with the game (level.ts, gltf-level.ts), on top of build_test_climb.py's (COL_ boxes, route, ground, SPAWN,
# GOAL):
#
#   ZONE_<n>          an empty in each file: zone = n, title, base and top (metres, Blender's z); style = lit (the game
#                     draws the file's own materials, lit, instead of the toned look of build_test_climb.py)
#   COL_<name>        route = n numbers each file's blocks from 1; the files join in zone order
#     fan = h         an updraft over the box, h metres high; strength = its upward push (m/s²)
#     mover = 1       the box drifts to (move_x, move_y, move_z) from where it is (Blender axes) and back, every period s
#     crumble = s     the box breaks s seconds after the agent first stands on it, and comes back a little later
#   <name>, <name>__* scenery that goes with COL_<name> (it moves or falls with it)
#   BEACON_<n>        an empty: an assist-mode checkpoint (beacon = n, in climbing order), where the agent's feet go
#   GOAL              the ring (zone 5); ring_radius and ring_tube give its size: touching it finishes the climb
#
#   SKY_<name>        scenery of the sky: drawn without fog, however far
#
#   climb.json        beside the .glb files: each zone's title, base, top and look (sky, sun, fog), and where the ring is
#                     (game axes), so the HUD's altimeter, the goal and the sky are known before the top zones load
#
# Blender works Z up; the glTF exporter turns that into +Y up and Blender's +Y into -Z. Sizes are metres at the agent's scale
# (1.2 m tall). Custom properties are not turned by the exporter: move_x/y/z stay in Blender's axes (level.ts turns them).

import json
import math
import os
import random
import shutil
import subprocess
import sys
import zlib

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
ASSETS = os.path.join(ROOT, 'src', 'game', 'ascent', 'assets')
OUT_DIR = os.path.join(HERE, 'out')
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def srgb(hex_code):
    """A token's sRGB hex as a linear RGBA tuple (Blender colours are linear)."""
    h = hex_code.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


# The palette: name: (base colour, roughness, metallic, glow). A glow above 0 makes the material give off its own colour at that
# strength (lights, screens, LEDs). The game reads these from the file; the names are only for reading the script.
PALETTE = {
    # Workshop: warm wood, coloured book covers, a red tool chest, a glowing window and monitor.
    'wood': ('#9a6a45', 0.75, 0.0, 0.0),
    'wood-dark': ('#7c5235', 0.75, 0.0, 0.0),
    'wall': ('#4e7f7b', 0.9, 0.0, 0.0),
    'window': ('#ffd9a0', 0.5, 0.0, 0.9),
    'book-red': ('#c0392b', 0.65, 0.0, 0.0),
    'book-blue': ('#2f6fd6', 0.65, 0.0, 0.0),
    'book-green': ('#2f9e5b', 0.65, 0.0, 0.0),
    'book-yellow': ('#e9b824', 0.65, 0.0, 0.0),
    'book-purple': ('#7e4fb6', 0.65, 0.0, 0.0),
    'book-teal': ('#1d9aa8', 0.65, 0.0, 0.0),
    'paper': ('#f3ead6', 0.9, 0.0, 0.0),
    'tool-red': ('#cc3b2f', 0.45, 0.1, 0.0),
    'tool-yellow': ('#f2b42c', 0.45, 0.1, 0.0),
    'steel': ('#a3acb6', 0.3, 0.25, 0.0),
    'plastic': ('#2c3038', 0.55, 0.0, 0.0),
    'chip': ('#1c1e24', 0.45, 0.0, 0.0),
    'pin': ('#d4d8de', 0.25, 0.25, 0.0),
    'floppy': ('#2d538f', 0.55, 0.0, 0.0),
    'label': ('#f5f2ea', 0.9, 0.0, 0.0),
    'screen': ('#6fb5ff', 0.3, 0.0, 1.6),
    'led-blue': ('#46c8ff', 0.3, 0.0, 3.0),
    'ceiling': ('#e3d8c6', 0.9, 0.0, 0.0),
    'tile-dark': ('#2b3039', 0.6, 0.1, 0.0),
    'lamp': ('#fff1d6', 0.4, 0.0, 4.0),
    'cork': ('#b2834f', 0.9, 0.0, 0.0),
    'note-yellow': ('#f6d65a', 0.85, 0.0, 0.0),
    'note-pink': ('#f29bb4', 0.85, 0.0, 0.0),
    'note-blue': ('#8ec5f2', 0.85, 0.0, 0.0),
    'mug': ('#d6493b', 0.35, 0.0, 0.0),
    'coffee': ('#3a2316', 0.15, 0.0, 0.0),
    'pencil': ('#f2c230', 0.5, 0.0, 0.0),
    'graphite': ('#3a3a3f', 0.4, 0.2, 0.0),
    'radiator': ('#ebe7df', 0.45, 0.1, 0.0),
    'ruler': ('#e5cf7a', 0.6, 0.0, 0.0),
    # Server stack: navy racks with status lights, aluminium heat sinks, orange cable trays, glowing fan rings.
    'rack': ('#46566f', 0.5, 0.3, 0.0),
    'rack-dark': ('#2a3342', 0.55, 0.2, 0.0),
    'alu': ('#bcc3cb', 0.3, 0.25, 0.0),
    'tray': ('#e8802a', 0.55, 0.1, 0.0),
    'led-green': ('#3dff8b', 0.3, 0.0, 3.0),
    'led-amber': ('#ffb547', 0.3, 0.0, 3.0),
    'fan-ring': ('#46e0ff', 0.3, 0.0, 2.2),
    'hall-floor': ('#323a48', 0.6, 0.1, 0.0),
    'cable': ('#1d222b', 0.6, 0.0, 0.0),
    'cable-blue': ('#2f6fd0', 0.5, 0.0, 0.0),
    # Cloud: soft clouds and pastel data blocks with glowing bits.
    'cloud': ('#f7f9fd', 0.95, 0.0, 0.0),
    'data-blue': ('#a3c8ff', 0.6, 0.0, 0.0),
    'data-lilac': ('#c9b7ff', 0.6, 0.0, 0.0),
    'data-mint': ('#a2e8d2', 0.6, 0.0, 0.0),
    'data-white': ('#eef3fb', 0.65, 0.0, 0.0),
    'data-bit': ('#5b8def', 0.3, 0.0, 1.8),
    # Upper air: blue solar panels with silver frames, orange girders, gold foil, white paint; the Earth below.
    'panel': ('#1f428f', 0.25, 0.25, 0.0),
    'panel-frame': ('#d9dde3', 0.35, 0.25, 0.0),
    'girder': ('#e9763d', 0.55, 0.2, 0.0),
    'paint': ('#eef0f3', 0.55, 0.1, 0.0),
    'foil': ('#d9a733', 0.3, 0.25, 0.0),
    'earth': ('#ffffff', 0.85, 0.0, 0.0),  # its colours are its painted texture (earth_texture)
    'balloon': ('#f1ece2', 0.6, 0.0, 0.0),
    # Orbit: asteroid rock, stars, the Moon, and the brass ring of the R7 logo.
    'rock': ('#8c7f74', 0.9, 0.0, 0.0),
    'rock-dark': ('#6b5f57', 0.9, 0.0, 0.0),
    'star': ('#fff6e0', 0.5, 0.0, 6.0),
    'moon': ('#c2beb6', 0.95, 0.0, 0.05),
    'brass': ('#c9a96a', 0.3, 0.25, 0.25),
    # Far off in orbit: a ringed planet, a station and a ship.
    'planet': ('#ffffff', 0.9, 0.0, 0.0),  # its colours are its painted texture (planet_texture)
    'ring-light': ('#e6d6b4', 0.9, 0.0, 0.0),
    'ring-mid': ('#bfa47a', 0.9, 0.0, 0.0),
    'ring-dark': ('#8c7556', 0.9, 0.0, 0.0),
    'hull': ('#dfe3e8', 0.45, 0.15, 0.0),
    'engine': ('#8fd3ff', 0.3, 0.0, 5.0),
    'beacon-red': ('#ff4a3d', 0.3, 0.0, 4.0),
}
BOOKS = ('book-red', 'book-blue', 'book-green', 'book-yellow', 'book-purple', 'book-teal')
DATA = ('data-blue', 'data-lilac', 'data-mint', 'data-white')
LEDS = ('led-green', 'led-blue', 'led-amber')

# The painted detail: a material named here gets a tileable texture made below with numpy (a grey pattern its colour is
# multiplied by, and a bump map from the same pattern), repeating every `tile` metres on UVs projected from the box's sides.
# kind, tile (m), bump strength. Glows, clouds and the sky's far spheres stay plain.
TEXTURED = {
    # Server stack: rack fronts of units and vents, brushed heat sinks, painted trays, a raised floor.
    'rack': ('vents', 2.0, 0.6), 'rack-dark': ('plastic', 1.5, 0.3), 'alu': ('brushed', 1.0, 0.35),
    'tray': ('paint', 2.0, 0.3), 'hall-floor': ('tiles', 3.0, 0.6), 'cable-blue': ('plastic', 1.5, 0.2),
    # Cloud: a faint grid on the data blocks.
    **{b: ('grid', 2.0, 0.25) for b in DATA},
    # Upper air and orbit: solar cells, crinkled gold foil, painted girders, hull plates, rock.
    'panel': ('cells', 1.2, 0.5), 'panel-frame': ('brushed', 1.0, 0.35), 'girder': ('paint', 2.0, 0.3),
    'paint': ('paint', 2.0, 0.3), 'foil': ('foil', 1.5, 0.9), 'hull': ('plates', 4.0, 0.4), 'balloon': ('paint', 4.0, 0.2),
    'rock': ('rock', 3.0, 0.9), 'rock-dark': ('rock', 3.0, 0.9),
    'wood': ('grain', 3.0, 0.7), 'wood-dark': ('grain', 3.0, 0.7), 'ruler': ('grain', 2.0, 0.4),
    'wall': ('plaster', 8.0, 0.5), 'ceiling': ('plaster', 8.0, 0.5), 'label': ('plaster', 1.0, 0.2),
    'cork': ('cork', 1.5, 0.8), 'tile-dark': ('tiles', 4.0, 0.6),
    **{b: ('cloth', 0.8, 0.5) for b in BOOKS},
    'paper': ('pages', 0.5, 0.7),
    'tool-red': ('paint', 2.0, 0.3), 'tool-yellow': ('paint', 2.0, 0.3), 'mug': ('paint', 2.0, 0.2),
    'radiator': ('paint', 2.0, 0.3), 'pencil': ('paint', 1.0, 0.3),
    'steel': ('brushed', 1.0, 0.35), 'pin': ('brushed', 1.0, 0.35),
    'plastic': ('plastic', 1.5, 0.3), 'chip': ('plastic', 1.5, 0.3), 'floppy': ('plastic', 1.5, 0.3),
}
TEX_SIZE = 512
TEX_DIR = os.path.join(HERE, 'out', 'textures')
TEXTURES = {}
# A texture's grey averages this (linear): its material's colour is divided by it, so the colour on average stays the palette's.
TEX_MEAN = 0.9


def _noise(rng, n, fu, fv):
    """Tileable noise, -1 to 1: white noise kept to about fu cycles across a tile and fv down it (the FFT wraps, so it tiles)."""
    import numpy as np
    f = np.fft.fft2(rng.standard_normal((n, n)))
    ky = np.fft.fftfreq(n)[:, None] * n
    kx = np.fft.fftfreq(n)[None, :] * n
    f *= np.exp(-((kx / fu) ** 2 + (ky / fv) ** 2))
    out = np.real(np.fft.ifft2(f))
    return out / (np.abs(out).max() + 1e-9)


def pattern(kind):
    """A kind's grey (linear, about TEX_MEAN) and height (0 to 1), as n x n arrays; rows run along v, columns along u."""
    import numpy as np
    rng = np.random.default_rng(zlib.crc32(kind.encode()))
    n = TEX_SIZE
    u = np.arange(n)[None, :] / n
    v = np.arange(n)[:, None] / n
    if kind == 'grain':  # wood: rings and fine fibres running along v
        low = _noise(rng, n, 3, 1.2)
        fibre = _noise(rng, n, 90, 2)
        rings = np.sin(2 * np.pi * (14 * u + 0.8 * low))
        a = 1 + 0.06 * rings + 0.05 * fibre + 0.04 * low
        h = 0.5 + 0.25 * rings + 0.25 * fibre
    elif kind == 'cloth':  # book cloth: a fine weave over a soft mottle
        weave = np.sin(2 * np.pi * 64 * u) * np.sin(2 * np.pi * 64 * v)
        fine = _noise(rng, n, 140, 140)
        low = _noise(rng, n, 4, 4)
        a = 1 + 0.03 * weave + 0.04 * fine + 0.05 * low
        h = 0.5 + 0.3 * weave + 0.2 * fine
    elif kind == 'pages':  # a book's page edges: thin lines across
        lines = np.sin(2 * np.pi * 96 * v + 0.6 * _noise(rng, n, 2, 2))
        a = 1 + 0.035 * lines + 0.03 * _noise(rng, n, 6, 60)
        h = 0.5 + 0.4 * lines
    elif kind == 'paint':  # painted metal: a faint mottle and speckle
        low = _noise(rng, n, 4, 4)
        speck = _noise(rng, n, 200, 200)
        a = 1 + 0.03 * low + 0.02 * speck
        h = 0.5 + 0.15 * low + 0.25 * speck
    elif kind == 'brushed':  # brushed steel: streaks along u
        s = _noise(rng, n, 2, 220)
        a = 1 + 0.08 * s
        h = 0.5 + 0.3 * s
    elif kind == 'plaster':  # walls: soft blotches and a fine grain
        low, mid, fine = _noise(rng, n, 3, 3), _noise(rng, n, 20, 20), _noise(rng, n, 150, 150)
        a = 1 + 0.05 * low + 0.03 * mid + 0.02 * fine
        h = 0.5 + 0.2 * mid + 0.2 * fine
    elif kind == 'cork':
        grains = _noise(rng, n, 120, 120)
        a = 1 + 0.12 * grains + 0.05 * _noise(rng, n, 6, 6)
        h = 0.5 + 0.45 * grains
    elif kind == 'tiles':  # floor tiles: a square grid of grout lines
        gu = np.minimum(u % 0.5, 0.5 - u % 0.5)
        gv = np.minimum(v % 0.5, 0.5 - v % 0.5)
        grout = (np.minimum(gu, gv) < 0.008).astype(float)
        mottle = _noise(rng, n, 8, 8)
        a = 1 + 0.04 * mottle - 0.35 * grout
        h = 0.6 + 0.1 * mottle - 0.5 * grout
    elif kind == 'vents':  # a rack's front: units stacked up v, each a band of round holes between plain strips
        unit = (v * 8) % 1
        seam = (np.minimum(unit, 1 - unit) < 0.03).astype(float)
        band = ((unit > 0.25) & (unit < 0.75) & ((u * 2) % 1 > 0.06) & ((u * 2) % 1 < 0.94)).astype(float)
        holes = ((np.sin(2 * np.pi * 96 * u) * np.sin(2 * np.pi * 96 * v)) > 0.45).astype(float) * band
        mottle = _noise(rng, n, 5, 5)
        a = 1 + 0.03 * mottle - 0.3 * seam - 0.35 * holes
        h = 0.6 + 0.05 * mottle - 0.4 * seam - 0.4 * holes
    elif kind == 'grid':  # data blocks: a faint grid of lines over a soft mottle
        gu = np.minimum(u % 0.25, 0.25 - u % 0.25)
        gv = np.minimum(v % 0.25, 0.25 - v % 0.25)
        lines = (np.minimum(gu, gv) < 0.004).astype(float)
        low = _noise(rng, n, 4, 4)
        a = 1 + 0.03 * low - 0.1 * lines
        h = 0.5 + 0.1 * low - 0.3 * lines
    elif kind == 'cells':  # solar cells: dark squares in a silver grid, thin bus lines across each
        gu = np.minimum((u * 6) % 1, 1 - (u * 6) % 1)
        gv = np.minimum((v * 6) % 1, 1 - (v * 6) % 1)
        grid = (np.minimum(gu, gv) < 0.04).astype(float)
        bus = (np.minimum((v * 18) % 1, 1 - (v * 18) % 1) < 0.04).astype(float) * (1 - grid)
        sheen = _noise(rng, n, 3, 3)
        a = 0.85 + 0.05 * sheen + 0.6 * grid + 0.2 * bus
        h = 0.5 + 0.3 * grid + 0.1 * bus
    elif kind == 'foil':  # gold foil: crinkles in two sizes, catching the light at random
        c = np.abs(_noise(rng, n, 24, 24)) + 0.5 * np.abs(_noise(rng, n, 60, 60))
        a = 0.8 + 0.35 * c
        h = np.clip(c, 0, 1)
    elif kind == 'plates':  # hull plates: panel lines and a faint mottle
        gu = np.minimum((u * 2) % 1, 1 - (u * 2) % 1)
        gv = np.minimum((v * 3) % 1, 1 - (v * 3) % 1)
        lines = (np.minimum(gu, gv) < 0.006).astype(float)
        mottle = _noise(rng, n, 6, 6)
        a = 1 + 0.04 * mottle - 0.25 * lines
        h = 0.6 + 0.05 * mottle - 0.4 * lines
    elif kind == 'rock':  # rock: lumps at three sizes and a scatter of small craters
        lumps = _noise(rng, n, 4, 4) + 0.5 * _noise(rng, n, 16, 16) + 0.25 * _noise(rng, n, 64, 64)
        pits = np.zeros((n, n))
        for _ in range(40):
            cu, cv, r = rng.random(), rng.random(), rng.uniform(0.01, 0.05)
            du = np.minimum(np.abs(u - cu), 1 - np.abs(u - cu))  # wrapped, so it tiles
            dv = np.minimum(np.abs(v - cv), 1 - np.abs(v - cv))
            d = np.sqrt(du ** 2 + dv ** 2) / r
            pits += np.where(d < 1, -(1 - d ** 2), 0) + np.where((d >= 1) & (d < 1.3), 0.4 * (1.3 - d) / 0.3, 0)
        a = 1 + 0.1 * lumps + 0.08 * pits
        h = 0.5 + 0.2 * lumps + 0.3 * pits
    else:  # plastic: nearly smooth
        fine, low = _noise(rng, n, 120, 120), _noise(rng, n, 5, 5)
        a = 1 + 0.03 * low + 0.015 * fine
        h = 0.5 + 0.25 * fine
    a = np.clip(a * TEX_MEAN, 0, 1)
    return a, np.clip(h, 0, 1)


def _image(name, rgb, colour):
    import numpy as np
    os.makedirs(TEX_DIR, exist_ok=True)
    n = rgb.shape[0]
    img = bpy.data.images.new(name, n, n, alpha=False)
    if not colour:
        img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(np.dstack([rgb, np.ones((n, n, 1))]).astype(np.float32).ravel())
    path = os.path.join(TEX_DIR, f'{name}.png')
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)
    out = bpy.data.images.load(path, check_existing=True)
    if not colour:
        out.colorspace_settings.name = 'Non-Color'
    return out


def texture(kind):
    """The kind's two images: its grey (sRGB) and its bump map (a normal map from the height, OpenGL's +Y)."""
    import numpy as np
    if kind not in TEXTURES:
        a, h = pattern(kind)
        grey = np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)
        # The bump map at half the size (the height averaged over 2 x 2): it is most of a zone's picture bytes otherwise.
        h = h.reshape(TEX_SIZE // 2, 2, TEX_SIZE // 2, 2).mean(axis=(1, 3))
        n = TEX_SIZE // 2
        dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * n / 64
        dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * n / 64
        normal = np.dstack([-dx, -dy, np.ones_like(h)])
        normal /= np.linalg.norm(normal, axis=2, keepdims=True)
        TEXTURES[kind] = (_image(f'tex-{kind}', np.dstack([grey] * 3), True),
                          _image(f'tex-{kind}-normal', normal * 0.5 + 0.5, False))
    return TEXTURES[kind]


def earth_texture(w=1536, h=768):
    """The Earth's paint, wrapped round the sphere by its own UVs (longitude across, latitude up): oceans deep and shallow near
    the coasts, continents green to sand with ice at the poles, and swirls of cloud over it. The patterns are waves summed over
    the sphere itself, so nothing is stretched at the poles or seamed where the wrap meets."""
    import numpy as np
    rng = np.random.default_rng(42)
    lon = (np.arange(w) + 0.5) / w * 2 * np.pi
    lat = -np.pi / 2 + (np.arange(h) + 0.5) / h * np.pi
    lon, lat = np.meshgrid(lon, lat)
    p = np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], axis=-1)

    def field(n, k0, k1, stretch=(1.0, 1.0, 1.0)):
        """n waves across the sphere, k0 to k1 cycles a radian, the fine ones weaker (1/k): a fractal pattern. `stretch`
        leans the waves' directions (more z: bands along the latitudes, as clouds lie)."""
        out = np.zeros(lat.shape)
        for _ in range(n):
            d = rng.normal(size=3) * np.array(stretch)
            d /= np.linalg.norm(d)
            k = rng.uniform(k0, k1)
            out += np.sin(k * (p @ d) + rng.uniform(0, 2 * np.pi)) / k
        return out / np.abs(out).max()

    def hexes(*codes):
        return [np.array(srgb(c)[:3]) for c in codes]

    deep, shallow, green, forest, sand, ice = hexes('#163f8a', '#2f86d6', '#4f9a4a', '#2f6e3c', '#c9ae74', '#eef3f8')
    height = field(220, 1.5, 80)
    shore = np.quantile(height, 0.6)  # about 40% land
    span = np.quantile(height, 0.95) - np.quantile(height, 0.05)
    land = np.clip((height - shore) / (0.02 * span), 0, 1)[..., None]
    coast = np.clip(1 - (shore - height) / (0.25 * span), 0, 1)[..., None]
    swell = field(60, 6, 60)[..., None]  # the sea's own shading, deeper and lighter
    ocean = deep + (shallow - deep) * np.clip(coast ** 2 + 0.15 * swell, 0, 1)
    kind = field(120, 3, 60)[..., None]
    dry = np.clip((kind - 0.1) / 0.3, 0, 1) * np.clip(1 - np.abs(lat[..., None]) / 0.9, 0, 1)
    ground = green + (forest - green) * np.clip(-kind * 2, 0, 1)
    ground = ground + (sand - ground) * dry
    surface = ocean + (ground - ocean) * land
    polar = np.clip((np.abs(lat) - 1.2) / 0.12, 0, 1)[..., None]
    surface = surface + (ice - surface) * polar
    cloud = field(200, 5, 90, stretch=(0.5, 0.5, 2.5)) * (0.75 + 0.25 * np.cos(3 * lat))
    cover = (np.clip((cloud - np.quantile(cloud, 0.7)) / (0.15 * np.ptp(cloud)), 0, 1) * 0.85)[..., None]
    rgb = surface + (ice - surface) * cover
    srgb_rgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(np.clip(rgb, 0, 1), 1 / 2.4) - 0.055)
    os.makedirs(TEX_DIR, exist_ok=True)
    img = bpy.data.images.new('tex-earth', w, h, alpha=False)
    img.pixels.foreach_set(np.dstack([srgb_rgb, np.ones((h, w, 1))]).astype(np.float32).ravel())
    path = os.path.join(TEX_DIR, 'tex-earth.png')
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)
    return bpy.data.images.load(path, check_existing=True)


def planet_texture(w=1024, h=512):
    """The ringed planet's paint, wrapped by its UVs: bands of cream, tan and rust along the latitudes, their edges stirred
    by waves round the sphere, and one pale oval storm."""
    import numpy as np
    rng = np.random.default_rng(7)
    lon = (np.arange(w) + 0.5) / w * 2 * np.pi
    lat = -np.pi / 2 + (np.arange(h) + 0.5) / h * np.pi
    lon, lat = np.meshgrid(lon, lat)
    p = np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], axis=-1)
    stir = np.zeros(lat.shape)
    for _ in range(80):
        d = rng.normal(size=3)
        d /= np.linalg.norm(d)
        k = rng.uniform(3, 40)
        stir += np.sin(k * (p @ d) + rng.uniform(0, 2 * np.pi)) / k
    stir /= np.abs(stir).max()
    t = lat * 5.0 + 0.35 * stir + 0.08 * np.sin(lat * 23.0)
    stops = [np.array(srgb(c)[:3]) for c in ('#efe2c4', '#c99d68', '#e6d3ae', '#a8704a', '#f1e7d0', '#b98a5a')]
    f = (t / (2 * np.pi) * len(stops)) % len(stops)
    i0 = np.floor(f).astype(int)
    frac = (f - i0)[..., None]
    frac = frac * frac * (3 - 2 * frac)
    table = np.array(stops)
    rgb = table[i0 % len(stops)] * (1 - frac) + table[(i0 + 1) % len(stops)] * frac
    # The storm: a pale oval in the southern bands.
    d = np.sqrt(((lon - 2.2) / 0.28) ** 2 + ((lat + 0.38) / 0.11) ** 2)
    storm = np.clip(1.2 - d, 0, 1)[..., None]
    rgb = rgb + (np.array(srgb('#f6ead2')[:3]) - rgb) * storm
    srgb_rgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(np.clip(rgb, 0, 1), 1 / 2.4) - 0.055)
    os.makedirs(TEX_DIR, exist_ok=True)
    img = bpy.data.images.new('tex-planet', w, h, alpha=False)
    img.pixels.foreach_set(np.dstack([srgb_rgb, np.ones((h, w, 1))]).astype(np.float32).ravel())
    path = os.path.join(TEX_DIR, 'tex-planet.png')
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)
    return bpy.data.images.load(path, check_existing=True)


# The sky's spheres painted all over (their UVs are the sphere's own, not box_uv's).
PAINTED = {'earth': earth_texture, 'planet': planet_texture}


def box_uv(bm, offset, tile):
    """UVs projected onto each face from the axis it faces most, in world metres / tile, so textures meet across pieces."""
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            p = loop.vert.co + offset
            if ax == 2:
                u, v = p.x, p.y
            elif ax == 0:
                u, v = p.y, p.z
            else:
                u, v = p.x, p.z
            loop[uv].uv = (u / tile, v / tile)

# Each zone's sky, sun and fog, for the game (climb.json) and the previews: the sky's colour overhead and at the horizon, the
# ground's (the light from below), the sun's colour and strength and where it comes from (Blender axes: a direction towards
# it), how much light the sky gives, and how much of a starfield shows (0 to 1). `fill` is the sky light's colour from above
# where it is not the horizon's (indoors: light bounced off the walls, not the fog's dark). The game blends them as the agent climbs.
# One sun for the whole climb: the zones change its colour and strength, never where it is. The game blends the looks by the
# agent's height, so a sun that moved from zone to zone turned as the agent jumped near a zone's edge, and the shadows of
# blocks high above swung across the clouds (the author filmed it at 138 m, where the server's and the cloud's suns met).
SUN_DIR = (0.35, -0.3, 0.88)
LOOKS = {
    'workshop': dict(top='#4a3526', horizon='#4a392b', ground='#6b4a30', sun='#ffe4bd', strength=3.2,
                     sun_dir=SUN_DIR, ambient=0.75, stars=0.0, fill='#e8d2b4'),
    'server': dict(top='#0c1525', horizon='#1d3e63', ground='#2a3a52', sun='#b4dcff', strength=3.4,
                   sun_dir=SUN_DIR, ambient=0.8, stars=0.0, fill='#9ab4d8'),
    'cloud': dict(top='#4e9be9', horizon='#d2e8ff', ground='#a3cdf2', sun='#fff4df', strength=3.6,
                  sun_dir=SUN_DIR, ambient=0.75, stars=0.0, fill='#dcebff'),
    'upper': dict(top='#0d1c4a', horizon='#3f73cc', ground='#1f428f', sun='#ffffff', strength=4.0,
                  sun_dir=SUN_DIR, ambient=0.65, stars=0.35, fill='#a9c4ee'),
    'orbit': dict(top='#02020a', horizon='#0c1236', ground='#2a4f8f', sun='#fff7e6', strength=4.5,
                  sun_dir=SUN_DIR, ambient=0.9, stars=1.0, fill='#a3b2d6'),
}


# ------------------------------------------------------------------------------------------------- the jump (config.ts)
SPEED = 6.0
JUMP_HEIGHT = 1.6
TIME_TO_APEX = 0.38
FALL_MULTIPLIER = 1.4
GRAVITY = 2 * JUMP_HEIGHT / TIME_TO_APEX ** 2
FALL_GRAVITY = GRAVITY * FALL_MULTIPLIER
MARGIN = 0.8                  # level.vitest.ts: a step asks for at most this share of the reach
MAX_RISE = 0.8 * JUMP_HEIGHT  # ... and rises at most this much
AGENT_HEIGHT = 1.2
HEADROOM = 2.9                # nothing this close above a landing (the jump's top plus the agent)


def reach(rise):
    """How far a full jump at top speed carries the agent across, landing `rise` higher (config.ts jumpReach)."""
    if rise > JUMP_HEIGHT:
        return 0.0
    return SPEED * (TIME_TO_APEX + math.sqrt(2 * (JUMP_HEIGHT - rise) / FALL_GRAVITY))


# --------------------------------------------------------------------------------------------------------------- zones

ZONES = [
    # n, key, title, top of the zone (m), middle (x, y), radius of the walk, rise, gap, block size, the new kind and how often
    dict(n=1, key='workshop', title='Workshop', top=70, middle=(0.0, 0.0), radius=(7.5, 10.5),
         rise=(0.35, 0.85), gap=(0.6, 1.7), size=(1.6, 2.8), every={'beam': 11}),
    dict(n=2, key='server', title='Server stack', top=150, middle=(1.0, 1.0), radius=(7.0, 10.0),
         rise=(0.4, 0.95), gap=(0.9, 2.1), size=(1.3, 2.4), every={'fan': 9, 'beam': 13}),
    dict(n=3, key='cloud', title='Cloud', top=228, middle=(0.0, 2.0), radius=(8.0, 12.0),
         rise=(0.45, 1.0), gap=(1.1, 2.3), size=(1.2, 2.2), every={'mover': 4}),
    dict(n=4, key='upper', title='Upper air', top=300, middle=(-1.0, 1.0), radius=(8.0, 11.5),
         rise=(0.5, 1.05), gap=(1.2, 2.4), size=(1.0, 1.8), every={'crumble': 3, 'beam': 7}),
    dict(n=5, key='orbit', title='Orbit', top=345, middle=(0.0, 0.0), radius=(9.0, 12.5),
         rise=(0.55, 1.1), gap=(1.4, 2.5), size=(0.9, 1.5), every={'mover': 5, 'crumble': 4, 'beam': 6}),
]
SEED = 2026

FAN_LIFT = (4.0, 5.5)     # how much higher than the fan the block after it is
FAN_STRENGTH = 42.0       # the updraft's push (m/s²), above gravity on the way up (22) and down (31)
MOVER_REACH = (3.0, 5.5)  # how far a drifting block goes
MOVER_PERIOD = (4.5, 6.5) # seconds for there and back
CRUMBLE_DELAY = 0.7
RING_RADIUS = 5.0
RING_TUBE = 0.18
RING_TILT = 0.42


# ---------------------------------------------------------------------------------------------------------- boxes (plan)
# A box is (x0, y0, z0, x1, y1, z1) in Blender's axes.

def bx(cx, cy, z0, z1, w, d):
    return (cx - w / 2, cy - d / 2, z0, cx + w / 2, cy + d / 2, z1)


def centre(b):
    return ((b[0] + b[3]) / 2, (b[1] + b[4]) / 2)


def overlaps(a, b, pad=0.0, zpad=0.0):
    return (a[0] < b[3] + pad and b[0] < a[3] + pad and a[1] < b[4] + pad and b[1] < a[4] + pad
            and a[2] < b[5] + zpad and b[2] < a[5] + zpad)


def gap(a, b):
    """The shortest distance across the ground between two footprints (0 when they overlap seen from above)."""
    dx = max(0.0, a[0] - b[3], b[0] - a[3])
    dy = max(0.0, a[1] - b[4], b[1] - a[4])
    return math.hypot(dx, dy)


def hull(*boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), min(b[2] for b in boxes),
            max(b[3] for b in boxes), max(b[4] for b in boxes), max(b[5] for b in boxes))


def moved(b, dx, dy, dz=0.0):
    return (b[0] + dx, b[1] + dy, b[2] + dz, b[3] + dx, b[4] + dy, b[5] + dz)


# ------------------------------------------------------------------------------------------------------- Blender helpers

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'


MATERIALS = {}


def material(name):
    """The palette's material by name: a Principled BSDF the glTF exporter writes as the game's material."""
    if name not in MATERIALS:
        colour, roughness, metallic, glow = PALETTE[name]
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        bsdf.inputs['Base Color'].default_value = srgb(colour)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        if glow:
            bsdf.inputs['Emission Color'].default_value = srgb(colour)
            bsdf.inputs['Emission Strength'].default_value = glow
        if name in PAINTED:
            tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
            tex.image = PAINTED[name]()
            mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if name in TEXTURED:
            # Base colour = the grey pattern x the colour (the exporter writes it as the texture and its factor), and the
            # bump map through a Normal Map node.
            kind, _, strength = TEXTURED[name]
            grey, bump = texture(kind)
            nodes, links = mat.node_tree.nodes, mat.node_tree.links
            tex = nodes.new('ShaderNodeTexImage')
            tex.image = grey
            mix = nodes.new('ShaderNodeMix')
            mix.data_type = 'RGBA'
            mix.blend_type = 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1.0
            a = next(s for s in mix.inputs if s.name == 'A' and s.type == 'RGBA')
            b = next(s for s in mix.inputs if s.name == 'B' and s.type == 'RGBA')
            lin = srgb(colour)
            b.default_value = tuple(min(1.0, c / TEX_MEAN) for c in lin[:3]) + (1.0,)
            links.new(tex.outputs['Color'], a)
            links.new(next(s for s in mix.outputs if s.name == 'Result' and s.type == 'RGBA'), bsdf.inputs['Base Color'])
            ntex = nodes.new('ShaderNodeTexImage')
            ntex.image = bump
            nmap = nodes.new('ShaderNodeNormalMap')
            nmap.inputs['Strength'].default_value = strength
            links.new(ntex.outputs['Color'], nmap.inputs['Color'])
            links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
        mat.diffuse_color = srgb(colour)
        mat.use_backface_culling = True  # one-sided in the game: every mesh is closed
        MATERIALS[name] = mat
    return MATERIALS[name]


class Zone:
    """One zone's Blender collection, its objects' names and its route."""

    def __init__(self, spec):
        self.spec = spec
        self.n = spec['n']
        self.collection = bpy.data.collections.new(f'zone-{self.n}')
        bpy.context.scene.collection.children.link(self.collection)
        self.route = 0
        self.names = set()
        self.base = None

    def link(self, obj):
        self.collection.objects.link(obj)
        return obj

    def unique(self, stem):
        # Blender's names are global: the zone's number keeps them apart across zones.
        i = 1
        while f'z{self.n}_{stem}_{i}' in self.names:
            i += 1
        name = f'z{self.n}_{stem}_{i}'
        self.names.add(name)
        return name


# Edges sharper than this stay sharp; gentler ones (a bevel's, a sphere's) are smoothed over. Face-area weighted normals keep
# big flat faces flat right up to their bevels.
SHARP = math.radians(50)


def mesh_object(zone, name, bm, location, mat, shadow=True, rounded=False):
    """A mesh of bm at location in mat; a seen mesh gets smooth edges and, if its material is textured, UVs. shadow=False:
    it casts none (the workshop's walls and ceiling: the light comes from inside the room). rounded: a soft shape (a cloud,
    a rock) smoothed evenly, without the weighting that keeps a box's big faces flat (it shows a sphere's facets)."""
    # The mesh's vertices about its own middle, the object placed there: the packed file keeps positions as floats with 16
    # bits (PACK), which stays under a millimetre on numbers this small, where world coordinates hundreds of metres up would not.
    if bm.verts:
        lo = Vector((min(v.co[i] for v in bm.verts) for i in range(3)))
        hi = Vector((max(v.co[i] for v in bm.verts) for i in range(3)))
        mid = (lo + hi) / 2
        bmesh.ops.translate(bm, vec=-mid, verts=bm.verts)
        location = Vector(location) + mid
    if mat:
        bm.normal_update()
        for e in bm.edges:
            if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > SHARP:
                e.smooth = False
        for f in bm.faces:
            f.smooth = True
        if mat in TEXTURED:
            box_uv(bm, location, TEXTURED[mat][1])
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = zone.link(bpy.data.objects.new(name, mesh))
    obj.location = location
    if mat:
        mesh.materials.append(material(mat))
    if mat and not rounded:
        mod = obj.modifiers.new('normals', 'WEIGHTED_NORMAL')
        mod.mode = 'FACE_AREA'
        mod.keep_sharp = True
    if not shadow:
        obj['shadow'] = 0
    return obj


def box(w, d, h):
    """A plain box (the collision boxes')."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    return bm


# Every seen box's edges are cut back this far (less on a thin one), so they catch the light instead of ending in a hard line.
# A piece thinner than BEVEL_MIN (a pin, a label, a tick on the ruler) stays sharp: its bevel would not show from the camera,
# and costs triangles (the zone files' size).
BEVEL = 0.04
BEVEL_MIN = 0.15


def cuboid(w, d, h):
    bm = box(w, d, h)
    c = min(BEVEL, 0.2 * min(w, d, h))
    if min(w, d, h) >= BEVEL_MIN:
        bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=c, segments=1, profile=0.5, affect='EDGES',
                        clamp_overlap=True)
    return bm


def chamfered(w, d, h, c):
    bm = cuboid(w, d, h)
    bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=c, segments=1, profile=0.5, affect='EDGES',
                    clamp_overlap=True)
    # The second bevel's faces come out in a different order from run to run, and some have more than four corners, which
    # Blender cuts into triangles differently each run too (ties broken by where things sit in memory). Each of those is flat
    # and convex, so it is cut here into a fan from its lowest corner, and the faces are sorted: the same every time.
    for f in [f for f in bm.faces if len(f.verts) > 4]:
        vs = list(f.verts)
        k = min(range(len(vs)), key=lambda i: tuple(round(c, 6) for c in reversed(vs[i].co)))
        vs = vs[k:] + vs[:k]
        for i in range(1, len(vs) - 1):
            bm.faces.new((vs[0], vs[i], vs[i + 1]))
        bm.faces.remove(f)
    return in_order(bm)


def cylinder(r, h, segments=20, r_top=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r,
                          radius2=r if r_top is None else r_top, depth=h)
    return bm


def torus(major, minor, major_segments=96, minor_segments=10):
    bm = bmesh.new()
    rings = []
    for i in range(major_segments):
        a = 2 * math.pi * i / major_segments
        ring = []
        for j in range(minor_segments):
            b = 2 * math.pi * j / minor_segments
            rr = major + minor * math.cos(b)
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), minor * math.sin(b))))
        rings.append(ring)
    for i in range(major_segments):
        r0, r1 = rings[i], rings[(i + 1) % major_segments]
        for j in range(minor_segments):
            k = (j + 1) % minor_segments
            bm.faces.new((r0[j], r1[j], r1[k], r0[k]))
    return bm


# While a prop is being made, its pieces are gathered here, one bmesh per material in world space, and become one mesh per
# material when it is done (make_prop): a few nodes per block instead of dozens keeps the files small.
GATHER = None


def add(bm, location, mat):
    """Put bm (made about its own middle) at location, into the prop being made."""
    bmesh.ops.translate(bm, vec=location, verts=bm.verts)
    tmp = bpy.data.meshes.new('gather')
    bm.to_mesh(tmp)
    bm.free()
    GATHER.setdefault(mat, bmesh.new()).from_mesh(tmp)
    bpy.data.meshes.remove(tmp)


def make_prop(zone, name, fn, b, rng):
    """Make a prop with fn(zone, name, b, rng): its body's material is the mesh <name>, any other <name>__<material>."""
    global GATHER
    GATHER = {}
    fn(zone, name, b, rng)
    parts, GATHER = GATHER, None
    for i, (mat, bm) in enumerate(parts.items()):
        mesh_object(zone, name if i == 0 else f'{name}__{mat}', bm, (0, 0, 0), mat)


def piece(zone, name, b, bm_fn, mat='plastic'):
    """Scenery filling box b (made by bm_fn(w, d, h) about its middle): part of the prop being made, or a mesh of its own."""
    w, d, h = b[3] - b[0], b[4] - b[1], b[5] - b[2]
    cx, cy = centre(b)
    location = (cx, cy, (b[2] + b[5]) / 2)
    if GATHER is not None:
        add(bm_fn(w, d, h), location, mat)
        return None
    return mesh_object(zone, name, bm_fn(w, d, h), location, mat)


def collider(zone, name, b, **props):
    """COL_<name>: the solid box b, invisible in the game."""
    w, d, h = b[3] - b[0], b[4] - b[1], b[5] - b[2]
    cx, cy = centre(b)
    # A unit cube scaled to the box: the file keeps a node's scale and position exactly, so the box is exact however the
    # vertices are packed.
    obj = mesh_object(zone, f'COL_{name}', box(1, 1, 1), (cx, cy, (b[2] + b[5]) / 2), None)
    obj.scale = (w, d, h)
    obj.display_type = 'WIRE'
    for k, v in props.items():
        obj[k] = v
    return obj


def empty(owner, name, location, **props):
    obj = owner.link(bpy.data.objects.new(name, None))
    obj.empty_display_type = 'ARROWS'
    obj.location = location
    for k, v in props.items():
        obj[k] = v
    return obj


# ------------------------------------------------------------------------------------------------------------- props
# What a block looks like, by zone. Each fills its box exactly at the top (the top is what the agent stands on); details sit on
# the sides or flush with the top, so nothing visible stands above or outside the solid. Made through make_prop, so they are
# scenery named after the box: <name> and <name>__<material> (they move and fall with it).

# A detail on a face (a label, a strip) stands this far proud of it: two faces of different materials in one plane flicker
# (climb.vitest.ts finds any). Thin enough that a foot on it does not show.
PROUD = 0.004


def detail(zone, name, part, b, mat='plastic', bm_fn=cuboid):
    return piece(zone, f'{name}__{part}', b, bm_fn, mat)


def in_order(bm):
    """Blender does not number a sphere's vertices and faces the same way every run: sorted by where they are, the files come
    out the same each time."""
    for seq, where in ((bm.verts, lambda v: v.co), (bm.faces, lambda f: f.calc_center_median())):
        order = sorted(seq, key=lambda e: tuple(round(c, 6) for c in reversed(where(e))))
        rank = {e: i for i, e in enumerate(order)}
        seq.sort(key=lambda e: rank[e])
    return bm


def sphere(r, subdivisions=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=r)
    return in_order(bm)


def prop_book(zone, name, b, rng):
    """A giant book lying flat: coloured covers top and bottom, cream pages inset a little on three sides, a spine."""
    x0, y0, z0, x1, y1, z1 = b
    cover = rng.choice(BOOKS)
    t = min(0.08, (z1 - z0) * 0.15)
    piece(zone, name, (x0, y0, z1 - t, x1, y1, z1), cuboid, cover)
    detail(zone, name, 'back', (x0, y0, z0, x1, y1, z0 + t), cover)
    spine_left = rng.random() < 0.5
    inset = 0.06
    # The pages stop inside the spine and run a little into the covers: a face of theirs in the plane of one of the spine's
    # would flicker with it (PROUD below).
    pages = (x0 + 0.02 if spine_left else x0 + inset, y0 + inset, z0 + t - 0.01, x1 - inset if spine_left else x1 - 0.02,
             y1 - inset, z1 - t + 0.01)
    detail(zone, name, 'pages', pages, 'paper')
    spine = (x0, y0, z0 + t, x0 + 0.05, y1, z1 - t) if spine_left else (x1 - 0.05, y0, z0 + t, x1, y1, z1 - t)
    detail(zone, name, 'spine', spine, cover)


def prop_case(zone, name, b, rng):
    """A tool box: a red or yellow body with a dark lid line and two steel latches on one side."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, rng.choice(('tool-red', 'tool-yellow')))
    zl = z1 - (z1 - z0) * 0.28
    detail(zone, name, 'lid', (x0 - 0.02, y0 - 0.02, zl - 0.03, x1 + 0.02, y1 + 0.02, zl), 'plastic')
    for f in (0.3, 0.7):
        x = x0 + (x1 - x0) * f
        detail(zone, name, f'latch{int(f * 10)}', (x - 0.09, y0 - 0.05, zl - 0.14, x + 0.09, y0, zl + 0.06), 'steel')


def prop_chip(zone, name, b, rng):
    """A giant chip: a black body with rows of silver pins down two sides."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, 'chip')
    n = max(3, int((y1 - y0) / 0.32))
    for i in range(n):
        y = y0 + (i + 0.5) * (y1 - y0) / n
        for side, (a0, a1) in (('l', (x0 - 0.12, x0)), ('r', (x1, x1 + 0.12))):
            detail(zone, name, f'pin{side}{i}', (a0, y - 0.05, z0, a1, y + 0.05, z0 + (z1 - z0) * 0.6), 'pin')


def prop_floppy(zone, name, b, rng):
    """A floppy disk: a blue plate with a steel shutter and a white label flush with the top."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, 'floppy')
    w, d = x1 - x0, y1 - y0
    detail(zone, name, 'shutter', (x0 + w * 0.3, y1 - d * 0.38, z1 - 0.01, x1 - w * 0.3, y1 - 0.02, z1 + PROUD), 'steel')
    detail(zone, name, 'label', (x0 + w * 0.15, y0 + 0.05, z1 - 0.01, x1 - w * 0.15, y0 + d * 0.45, z1 + PROUD), 'label')


def prop_rack(zone, name, b, rng):
    """A rack unit: a navy box with dark strips on two sides, each with a status light."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, 'rack')
    rows = min(8, max(2, int((z1 - z0) / 0.22)))  # a tall column gets a few strips, not dozens
    for i in range(rows):
        z = z0 + (i + 0.5) * (z1 - z0) / rows
        detail(zone, name, f'u{i}', (x0 + 0.08, y0 - 0.03, z - 0.035, x1 - 0.08, y0, z + 0.035), 'rack-dark')
        detail(zone, name, f'v{i}', (x0 + 0.08, y1, z - 0.035, x1 - 0.08, y1 + 0.03, z + 0.035), 'rack-dark')
        detail(zone, name, f'l{i}', (x1 - 0.2, y0 - 0.05, z - 0.025, x1 - 0.12, y0 - 0.02, z + 0.025), rng.choice(LEDS))


def prop_heatsink(zone, name, b, rng):
    """A heat sink: an aluminium base plate and fins up to the top, along its longer side."""
    x0, y0, z0, x1, y1, z1 = b
    base = z0 + (z1 - z0) * 0.35
    piece(zone, name, (x0, y0, z0, x1, y1, base), cuboid, 'alu')
    along_x = (x1 - x0) >= (y1 - y0)
    n = max(4, int(((y1 - y0) if along_x else (x1 - x0)) / 0.22))
    for i in range(n):
        if along_x:
            y = y0 + (i + 0.5) * (y1 - y0) / n
            detail(zone, name, f'fin{i}', (x0, y - 0.04, base, x1, y + 0.04, z1), 'alu')
        else:
            x = x0 + (i + 0.5) * (x1 - x0) / n
            detail(zone, name, f'fin{i}', (x - 0.04, y0, base, x + 0.04, y1, z1), 'alu')


def prop_tray(zone, name, b, rng):
    """A cable tray: an orange beam with steel rails flush with the top along both long edges."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, 'tray')
    if (x1 - x0) >= (y1 - y0):
        detail(zone, name, 'rail_a', (x0, y0 - 0.04, z0, x1, y0, z1), 'steel')
        detail(zone, name, 'rail_b', (x0, y1, z0, x1, y1 + 0.04, z1), 'steel')
    else:
        detail(zone, name, 'rail_a', (x0 - 0.04, y0, z0, x0, y1, z1), 'steel')
        detail(zone, name, 'rail_b', (x1, y0, z0, x1 + 0.04, y1, z1), 'steel')


def prop_fan(zone, name, b, rng):
    """A case fan lying on its back: a dark housing, a glowing ring and three aluminium blades under the top."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, (x0, y0, z0, x1, y1, z0 + 0.12), cuboid, 'plastic')
    w = x1 - x0
    for i, (a0, a1, b0, b1) in enumerate(((x0, x0 + 0.14, y0, y1), (x1 - 0.14, x1, y0, y1),
                                          (x0, x1, y0, y0 + 0.14), (x0, x1, y1 - 0.14, y1))):
        detail(zone, name, f'frame{i}', (a0, b0, z0 + 0.12, a1, b1, z1), 'plastic')
    cx, cy = centre(b)
    add(cylinder(w * 0.44, 0.06, 32), (cx, cy, z1 - 0.04), 'fan-ring')  # its top just under the frame's
    add(cylinder(w * 0.12, (z1 - z0) - 0.16, 16), (cx, cy, (z0 + z1) / 2 + 0.04), 'plastic')
    for i in range(3):
        blade = cuboid(w * 0.36, 0.14, 0.03)
        bmesh.ops.translate(blade, vec=(w * 0.2, 0, 0), verts=blade.verts)
        bmesh.ops.rotate(blade, verts=blade.verts, matrix=Matrix.Rotation(2 * math.pi * i / 3 + 0.3, 3, 'Z'))
        add(blade, (cx, cy, z1 - 0.12), 'alu')


def on_face(zone, name, part, b, face, u0, u1, za, zb, out0, out1, mat):
    """A detail on one side of box b ('x0', 'x1', 'y0' or 'y1'): u0 to u1 metres along the side from its start (x0 or y0),
    za to zb high, standing out0 to out1 metres out from the side. Its back lies on the side and is never seen, so it is left
    out; a detail no deeper than FLAT is its front alone (the zone files' size)."""
    x0, y0, _, x1, y1, _ = b
    axis = 1 if face[0] == 'y' else 0
    s = -1 if face[1] == '0' else 1
    flat = out1 - out0 <= FLAT

    def plate(w, d, h):
        bm = box(w, d, h)
        bm.normal_update()
        drop = [f for f in bm.faces if f.normal[axis] * s < (0.5 if flat else -0.5)]
        bmesh.ops.delete(bm, geom=drop, context='FACES')
        return bm

    if axis == 1:
        y = y0 if s < 0 else y1
        lo, hi = sorted((y + s * out0, y + s * out1))
        detail(zone, name, part, (x0 + u0, lo, za, x0 + u1, hi, zb), mat, plate)
    else:
        x = x0 if s < 0 else x1
        lo, hi = sorted((x + s * out0, x + s * out1))
        detail(zone, name, part, (lo, y0 + u0, za, hi, y0 + u1, zb), mat, plate)


FLAT = 0.015


def prop_data(zone, name, b, rng):
    """A data block in the cloud: a soft, chamfered pastel case made up as one of three kinds of storage, its details on its
    sides (the top stays clear to land on):

      drive    a label and two status lights, and on another side a dark port
      sled     a dark front panel across one side with a handle in the case's colour and two status lights
      module   a row of chips and a strip of contacts along one side, a status light on another
    """
    x0, y0, z0, x1, y1, z1 = b
    c = min(x1 - x0, y1 - y0, z1 - z0) * 0.12
    case = rng.choice(DATA)
    piece(zone, name, b, lambda w, d, h: chamfered(w, d, h, c), case)
    # The draws the earlier look took from the climb's generator, kept so every block after this one looks as it did.
    for _ in range(rng.randint(1, 3)):
        rng.choice('abcd'), rng.random(), rng.random(), rng.random()
    r = random.Random(zlib.crc32(name.encode()))
    faces = ['x0', 'x1', 'y0', 'y1']
    r.shuffle(faces)

    def side(f):  # how long a side is
        return (x1 - x0) if f[0] == 'y' else (y1 - y0)

    lo, hi = z0 + c + 0.04, z1 - c - 0.04  # the flat of a side, inside the chamfer
    mid = (lo + hi) / 2
    kind = r.choice(('drive', 'sled', 'module'))
    # Few details and few materials to a block (three or four): each material is a mesh of its own on a drifting block, and
    # every mesh and every box costs the zone file some bytes (500 kB at most, climb.vitest.ts).
    led = r.choice(LEDS)
    f = faces[0]
    n = side(f)
    if kind == 'drive':
        # The label ends before the lights begin (two details overlapping in one plane would flicker).
        on_face(zone, name, 'label', b, f, c + 0.08, min(c + 0.08 + 0.45 * n, n - c - 0.6), mid - 0.3 * (hi - lo),
                mid + 0.2 * (hi - lo), 0, 0.012, 'label')
        for i in range(2):
            u = n - c - 0.2 - i * 0.17
            on_face(zone, name, f'led{i}', b, f, u, u + 0.1, mid - 0.05, mid + 0.05, 0, 0.035, led)
        g = faces[1]
        m = side(g)
        w = min(0.7, 0.45 * m)
        pz = lo + 0.25 * (hi - lo)
        on_face(zone, name, 'port', b, g, (m - w) / 2, (m + w) / 2, pz - 0.11, pz + 0.11, 0, 0.03, 'chip')
    elif kind == 'sled':
        on_face(zone, name, 'bezel', b, f, c + 0.05, n - c - 0.05, lo, hi, 0, 0.03, 'chip')
        hz = hi - 0.18
        on_face(zone, name, 'handle', b, f, 0.25 * n, 0.75 * n, hz - 0.04, hz + 0.04, 0.03, 0.09, case)
        for i in range(2):
            u = n - c - 0.25 - i * 0.18
            on_face(zone, name, f'led{i}', b, f, u, u + 0.1, lo + 0.12, lo + 0.2, 0.03, 0.055, led)
    else:
        count = max(2, min(3, int((n - 2 * c) / 0.45)))
        span = n - 2 * c - 0.2
        for i in range(count):
            u = c + 0.1 + span * (i + 0.5) / count
            on_face(zone, name, f'chip{i}', b, f, u - 0.16, u + 0.16, mid - 0.12 * (hi - lo), mid + 0.28 * (hi - lo), 0,
                    0.03, 'chip')
        on_face(zone, name, 'contacts', b, f, c + 0.1, n - c - 0.1, lo, lo + 0.1, 0, 0.012, 'pin')
        g = faces[1]
        m = side(g)
        on_face(zone, name, 'led0', b, g, m / 2 - 0.05, m / 2 + 0.05, mid - 0.05, mid + 0.05, 0, 0.035, led)


def prop_panel(zone, name, b, rng):
    """A solar panel: a blue plate, its cells marked by silver strips flush with the top."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, 'panel')
    for i in range(1, 3):
        x = x0 + (x1 - x0) * i / 3
        detail(zone, name, f'gx{i}', (x - 0.025, y0 - PROUD, z1 - 0.02, x + 0.025, y1 + PROUD, z1 + PROUD), 'panel-frame')
        y = y0 + (y1 - y0) * i / 3
        detail(zone, name, f'gy{i}', (x0 - PROUD, y - 0.025, z1 - 0.02, x1 + PROUD, y + 0.025, z1 + PROUD), 'panel-frame')


def prop_girder(zone, name, b, rng):
    """A girder: an orange beam with white ribs down its sides."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, 'girder')
    along_x = (x1 - x0) >= (y1 - y0)
    length = (x1 - x0) if along_x else (y1 - y0)
    n = max(2, int(length / 0.8))
    for i in range(n):
        f = (i + 0.5) / n
        if along_x:
            x = x0 + (x1 - x0) * f
            detail(zone, name, f'rib{i}', (x - 0.04, y0 - 0.05, z0 - 0.15, x + 0.04, y1 + 0.05, z1 - 0.02), 'paint')
        else:
            y = y0 + (y1 - y0) * f
            detail(zone, name, f'rib{i}', (x0 - 0.05, y - 0.04, z0 - 0.15, x1 + 0.05, y + 0.04, z1 - 0.02), 'paint')


def lumpy(rng, amount, waves=6):
    """A smooth random bump over the unit sphere, about -amount to amount: a few waves summed, for rocks."""
    ws = []
    for _ in range(waves):
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
        ws.append((d, rng.uniform(1.5, 4.5), rng.uniform(0, 2 * math.pi)))

    def f(p):
        return amount * sum(math.sin(k * p.dot(d) + ph) for d, k, ph in ws) / math.sqrt(waves)
    return f


def asteroid(w, d, h, rng, extra):
    """A floating rock whose flat top fills the box's top (a rounded square, so little of the box's top is bare) and whose
    lumpy underside narrows to a point `extra` metres below the box. Made about the box's middle, as piece() wants."""
    bm = sphere(1.0, 2)
    bump = lumpy(rng, 0.08)
    for v in bm.verts:
        p = v.co.copy()
        x, y, z = p
        r = math.hypot(x, y)
        k = r / ((x ** 4 + y ** 4) ** 0.25) if r > 1e-6 else 1.0  # the circle stretched to a rounded square
        if z >= 0:
            f = 0.97 + min(0.03, bump(p) * 0.3)
            v.co = Vector((x * k * f * w / 2, y * k * f * d / 2, h / 2))
        else:
            f = 0.9 + bump(p)
            v.co = Vector((x * k * min(1.0, f) * w / 2, y * k * min(1.0, f) * d / 2, h / 2 + z * (h + extra) * f))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    return bm


def rock(size, rng):
    """A whole asteroid for the background: a lumpy, squashed sphere about `size` metres across (finer when it is big)."""
    bm = sphere(1.0, 3 if size > 8 else 2)
    bump = lumpy(rng, 0.18)
    sx, sy, sz = (size / 2 * rng.uniform(0.7, 1.2) for _ in range(3))
    for v in bm.verts:
        f = 1 + bump(v.co)
        v.co = Vector((v.co.x * sx * f, v.co.y * sy * f, v.co.z * sz * f))
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                     matrix=Matrix.Rotation(rng.uniform(0, math.pi), 3, Vector((rng.random(), rng.random(), 1)).normalized()))
    return bm


def prop_shard(zone, name, b, rng):
    """An asteroid in orbit: a lumpy rock, flat on top where the agent lands, narrowing to a point underneath."""
    extra = min(0.6, (b[5] - b[2]) * 0.5)
    piece(zone, name, b, lambda w, d, h: asteroid(w, d, h, rng, extra), rng.choice(('rock', 'rock', 'rock-dark')))


def prop_tower(zone, name, b, rng):
    """A PC case: dark, with a blue light strip down its front and steel vents."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, 'plastic')
    detail(zone, name, 'strip', (x0 + 0.3, y0 - 0.04, z0 + 1.0, x0 + 0.45, y0, z1 - 1.0), 'led-blue')
    for i in range(6):
        z = z0 + 2 + i * 1.2
        detail(zone, name, f'vent{i}', (x1 - 1.8, y0 - 0.03, z, x1 - 0.4, y0, z + 0.4), 'steel')


def prop_manuals(zone, name, b, rng):
    """A pile of thick manuals, each its own colour."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, (x0 + 0.3, y0 + 0.3, z0 + 0.02, x1 - 0.3, y1 - 0.3, z0 + 0.03), cuboid, 'paper')  # hidden inside
    z = z0
    i = 0
    while z < z1 - 1e-6:
        h = min(z1 - z, rng.uniform(1.2, 2.2))
        inset = rng.uniform(0.0, 0.25)
        detail(zone, name, f'm{i}', (x0 + inset, y0 + inset * 0.5, z, x1 - inset * 0.5, y1 - inset, z + h), BOOKS[i % len(BOOKS)])
        z += h
        i += 1


def prop_chest(zone, name, b, rng):
    """A red tool chest with steel drawer fronts and handles."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, 'tool-red')
    n = 5
    for i in range(n):
        za = z0 + (i + 0.15) * (z1 - z0) / n
        zb = z0 + (i + 0.85) * (z1 - z0) / n
        detail(zone, name, f'd{i}', (x0 + 0.2, y0 - 0.04, za, x1 - 0.2, y0, zb), 'tool-red')
        detail(zone, name, f'h{i}', (x0 + 1.4, y0 - 0.12, (za + zb) / 2 - 0.08, x1 - 1.4, y0 - 0.04, (za + zb) / 2 + 0.08), 'steel')


def prop_monitor(zone, name, b, rng):
    """A monitor standing on the chest: a black bezel and a glowing screen on the side facing the start."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, 'chip')
    detail(zone, name, 'screen', (x0 + 0.25, y0 - 0.02, z0 + 0.8, x1 - 0.25, y0, z1 - 0.3), 'screen')


PROPS = {
    'workshop': (prop_book, prop_book, prop_case, prop_chip, prop_floppy),
    'server': (prop_rack, prop_rack, prop_heatsink),
    'cloud': (prop_data,),
    'upper': (prop_panel, prop_panel, prop_girder),
    'orbit': (prop_shard,),
}
BEAM_PROPS = {'workshop': prop_case, 'server': prop_tray, 'cloud': prop_data, 'upper': prop_girder, 'orbit': prop_girder}
THICK = {'workshop': (0.45, 1.0), 'server': (0.5, 1.1), 'cloud': (0.7, 1.4), 'upper': (0.18, 0.3), 'orbit': (0.5, 1.2)}
FLOPPY_THICK = (0.12, 0.2)


# ------------------------------------------------------------------------------------------------------------- the walk

class Course:
    def __init__(self, rng):
        self.rng = rng
        self.solids = []      # every solid placed so far (boxes), to keep new ones clear of them
        self.steps = []       # (zone, kind, box, extra) in climbing order
        self.beacons = 0

    def clear(self, b, ignore=()):
        """Nothing within 0.25 m of b across, nor in the room above its top an agent needs to jump."""
        room = (b[0], b[1], b[2], b[3], b[4], b[5] + HEADROOM)
        for s in self.solids:
            if any(s is i for i in ignore):
                continue
            if overlaps(room, s, pad=0.25, zpad=0.05):
                return False
        return True

    def corridor_clear(self, a, b, ignore=()):
        """The air between two blocks, where the jump goes, is empty."""
        c = hull(a, b)
        air = (c[0] + 0.15, c[1] + 0.15, min(a[5], b[5]) + 0.05, c[3] - 0.15, c[4] - 0.15, max(a[5], b[5]) + 2.2)
        for s in self.solids:
            if s is a or s is b or any(s is i for i in ignore):
                continue
            if overlaps(air, s):
                return False
        return True


def travel(spec, prev_box, step, rng, jitter):
    """The way to go from prev_box: round the zone's middle (anticlockwise seen from above), held near the walk's radius."""
    mx, my = spec['middle']
    cx, cy = centre(prev_box)
    rx, ry = cx - mx, cy - my
    r = math.hypot(rx, ry) or 1.0
    lo, hi = spec['radius']
    target = (lo + hi) / 2 + (hi - lo) / 2 * math.sin(step * 0.37)
    tx, ty = -ry / r, rx / r
    pull = max(-1.2, min(1.2, (target - r) / 2.5))
    dx, dy = tx + pull * rx / r, ty + pull * ry / r
    a = math.atan2(dy, dx) + rng.gauss(0, jitter)
    return math.cos(a), math.sin(a)


def place(prev_box, size_w, size_d, top, thick, g, direction):
    """A box of the size, its top at `top`, along `direction` from prev_box so the gap between their footprints is g."""
    px, py = centre(prev_box)
    ux, uy = direction

    def at(t):
        return bx(px + ux * t, py + uy * t, top - thick, top, size_w, size_d)

    lo, hi = 0.0, 40.0
    for _ in range(50):
        mid = (lo + hi) / 2
        if gap(prev_box, at(mid)) < g:
            lo = mid
        else:
            hi = mid
    return at(hi)


def size_for(spec, kind, direction, rng):
    lo, hi = spec['size']
    if kind == 'beam':
        length = rng.uniform(3.0, 4.6)
        width = rng.uniform(0.45, 0.6)
        return (length, width) if abs(direction[0]) >= abs(direction[1]) else (width, length)
    if kind == 'fan':
        return 2.2, 2.2
    if kind == 'crumble':
        s = rng.uniform(1.2, 1.7)
        return s, s
    w = rng.uniform(lo, hi)
    return w, w * rng.uniform(0.75, 1.3)


def next_step(course, zone_spec, prev_box, step, kind, ignore=()):
    """Place the step after prev_box: the first candidate that is clear, trying wider turns as it goes."""
    rng = course.rng
    for attempt in range(400):
        jitter = 0.25 + attempt * 0.012
        direction = travel(zone_spec, prev_box, step, rng, jitter)
        w, d = size_for(zone_spec, kind, direction, rng)
        r0, r1 = zone_spec['rise']
        rise = rng.uniform(r0, min(r1, MAX_RISE - 0.05))
        top = prev_box[5] + rise
        g0, g1 = zone_spec['gap']
        g_max = min(g1, MARGIN * reach(rise) * 0.93)
        g = rng.uniform(min(g0, g_max * 0.8), g_max)
        if kind == 'crumble':
            thick = 0.18
        elif zone_spec['key'] == 'workshop' and rng.random() < 0.18:
            thick = rng.uniform(*FLOPPY_THICK)
        else:
            thick = rng.uniform(*THICK[zone_spec['key']])
        thick = min(thick, top)  # never into the floor
        cand = place(prev_box, w, d, top, thick, g, direction)
        if course.clear(cand, ignore) and course.corridor_clear(prev_box, cand, ignore):
            return cand
    raise RuntimeError(f'zone {zone_spec["n"]}: no room for step {step} ({kind}) after {prev_box}')


def walk(course, zones, spawn_box):
    """The whole route, zone by zone, from the floor by the spawn to the ring."""
    rng = course.rng
    prev = spawn_box
    step = 0
    counters = {}
    for zi, spec in enumerate(zones):
        zone = Z[zi]
        zone.base = prev[5]
        count = 0
        while prev[5] < spec['top']:
            step += 1
            count += 1
            kind = 'block'
            for k, every in spec['every'].items():
                if count % every == 0:
                    kind = k
                    break
            if kind == 'fan':
                fan = next_step(course, spec, prev, step, 'fan')
                course.solids.append(fan)
                course.steps.append((zone, 'fan', fan, {}))
                # The block the fan lifts the agent to: beside its column, well above it.
                lift = rng.uniform(*FAN_LIFT)
                for attempt in range(400):
                    direction = travel(spec, fan, step, rng, 0.3 + attempt * 0.01)
                    w, d = size_for(spec, 'block', direction, rng)
                    top = fan[5] + lift
                    cand = place(fan, w, d, top, rng.uniform(*THICK[spec['key']]), rng.uniform(0.35, 0.8), direction)
                    column = (fan[0], fan[1], fan[5], fan[3], fan[4], top + 2.5)
                    if (course.clear(cand) and not any(overlaps(column, s) for s in course.solids if s is not fan)):
                        break
                else:
                    raise RuntimeError(f'zone {spec["n"]}: no room above the fan at step {step}')
                course.solids.append(cand)
                height = round(top - fan[5] + 0.7, 2)
                course.steps[-1] = (zone, 'fan', fan, {'fan': height, 'strength': FAN_STRENGTH})
                course.steps.append((zone, 'block', cand, {}))
                prev = cand
                continue
            if kind == 'mover':
                start = next_step(course, spec, prev, step, 'block')
                for attempt in range(200):
                    direction = travel(spec, start, step + 1, rng, 0.3 + attempt * 0.01)
                    dist = rng.uniform(*MOVER_REACH)
                    end = moved(start, direction[0] * dist, direction[1] * dist)
                    swept = hull(start, end)
                    if course.clear(swept) and course.corridor_clear(prev, start):
                        break
                else:
                    raise RuntimeError(f'zone {spec["n"]}: no room for the mover at step {step}')
                course.solids.append(swept)  # nothing may be placed where it drifts
                extra = {'mover': 1, 'move_x': round(end[0] - start[0], 3), 'move_y': round(end[1] - start[1], 3),
                         'move_z': 0.0, 'period': round(rng.uniform(*MOVER_PERIOD), 2)}
                course.steps.append((zone, 'mover', start, extra))
                prev = end  # the next step is jumped to from the far end
                continue
            box = next_step(course, spec, prev, step, kind)
            course.solids.append(box)
            extra = {'crumble': CRUMBLE_DELAY} if kind == 'crumble' else {}
            course.steps.append((zone, kind, box, extra))
            prev = box
    return prev


# --------------------------------------------------------------------------------------------------------- set pieces

def workshop_floor(zone):
    """The floor (boards of two woods), the stack of hardware in the middle, and the room round it: two walls, a window."""
    rng = random.Random(1)
    for i in range(16):
        x = -32 + i * 4
        mesh_object(zone, f'floor_{i}', cuboid(4, 64, 1), (x + 2, 0, -0.5), 'wood' if i % 2 else 'wood-dark')
    collider(zone, 'floor', (-32, -32, -1, 32, 32, 0), ground=1)
    stack = [
        ('tower_case', (-2.6, -2.6, 0, 2.6, 2.6, 24), prop_tower),
        ('manuals', (-3.2, -2.4, 24, 3.2, 2.4, 33), prop_manuals),
        ('toolchest', (-2.4, -2.9, 33, 2.4, 2.9, 47), prop_chest),
        ('monitor', (-3.0, -1.0, 47, 3.0, 1.0, 66), prop_monitor),
    ]
    out = []
    for name, b, fn in stack:
        make_prop(zone, name, fn, b, rng)
        collider(zone, name, b)
        out.append(b)
    workshop_room(zone, rng)
    mesh_object(zone, 'window', cuboid(26, 0.1, 34), (6, 31.95, 30), 'window')
    for i, (x, z) in enumerate(((6, 13), (6, 47), (-7, 30), (19, 30))):
        w, h = (28, 1.2) if i < 2 else (1.2, 34)
        mesh_object(zone, f'window_frame_{i}', cuboid(w, 0.6, h), (x, 31.6, z), 'wood-dark')
    mesh_object(zone, 'shelf', cuboid(3, 30, 0.8), (-30.5, -4, 18), 'wood')
    for i in range(14):
        h = rng.uniform(3.5, 6.5)
        mesh_object(zone, f'shelf_book_{i}', cuboid(2.4, rng.uniform(0.9, 1.6), h), (-30.6, -17 + i * 1.9, 18.4 + h / 2),
                    BOOKS[i % len(BOOKS)])
    return out


# The workshop's ceiling: its underside, and the top the server stack stands on. The climb goes up through a square hatch in
# it, HATCH metres either side of the middle (the zone-2 route keeps well inside it).
CEILING = (72.0, 73.0)
HATCH = 16.5


def workshop_room(zone, rng):
    """Four walls with skirting boards, a ceiling with the hatch and lamps under it, a door, a radiator under the window, a
    cork board of notes, and a giant mug, pencil and ruler on the floor. Scenery only, well away from the route. The walls and
    the ceiling cast no shadow: the lamps are inside the room."""
    lo, hi = CEILING
    for name, size, at in (('wall_back', (64, 1, hi), (0, 32.5, hi / 2)), ('wall_front', (64, 1, hi), (0, -32.5, hi / 2)),
                           ('wall_left', (1, 66, hi), (-32.5, 0, hi / 2)), ('wall_right', (1, 66, hi), (32.5, 0, hi / 2))):
        mesh_object(zone, name, cuboid(*size), at, 'wall', shadow=False)
    for i, (size, at) in enumerate((((63.6, 0.3, 0.8), (0, 31.8, 0.4)), ((63.6, 0.3, 0.8), (0, -31.8, 0.4)),
                                    ((0.3, 63.0, 0.8), (-31.8, 0, 0.4)), ((0.3, 63.0, 0.8), (31.8, 0, 0.4)))):
        mesh_object(zone, f'skirting_{i}', cuboid(*size), at, 'wood-dark')
    # The ceiling round the hatch: plaster underneath, dark tiles on top (the server stack's floor).
    for i, (x0, y0, x1, y1) in enumerate(((-32, HATCH, 32, 32), (-32, -32, 32, -HATCH), (-32, -HATCH, -HATCH, HATCH),
                                          (HATCH, -HATCH, 32, HATCH))):  # inside the walls
        cx, cy, w, d = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
        mesh_object(zone, f'ceiling_{i}', cuboid(w, d, 0.5), (cx, cy, lo + 0.25), 'ceiling', shadow=False)
        mesh_object(zone, f'roof_{i}', cuboid(w, d, 0.5), (cx, cy, hi - 0.25), 'tile-dark', shadow=False)
    for i, (x, y) in enumerate(((-24, -24), (0, -24), (24, -24), (-24, 0), (24, 0), (-24, 24), (0, 24), (24, 24))):
        mesh_object(zone, f'lamp_{i}', cuboid(7, 1.6, 0.3), (x, y, lo - 0.15), 'lamp', shadow=False)
    # A door in the front wall, and its handle.
    mesh_object(zone, 'door', cuboid(10, 0.4, 22), (19, -31.75, 11), 'wood-dark')
    mesh_object(zone, 'door_handle', cuboid(1.6, 0.5, 0.4), (15.6, -31.3, 11), 'steel')
    # A radiator under the window: a row of fins.
    for i in range(14):
        mesh_object(zone, f'radiator_{i}', cuboid(0.9, 1.0, 6), (-4 + i * 1.6, 31.1, 4.5), 'radiator')
    mesh_object(zone, 'radiator_pipe', cuboid(22.4, 0.5, 0.5), (6.4, 31.1, 1.2), 'radiator')
    # A cork board on the right wall, with notes pinned to it.
    mesh_object(zone, 'cork_board', cuboid(0.4, 18, 12), (31.6, -2, 28), 'cork')
    notes = ('note-yellow', 'note-pink', 'note-blue')
    for i in range(9):
        y, z = -8.5 + (i % 3) * 5.5 + rng.uniform(-0.6, 0.6), 23.5 + (i // 3) * 4 + rng.uniform(-0.4, 0.4)
        mesh_object(zone, f'note_{i}', cuboid(0.06, 2.6, 2.6), (31.37, y, z), notes[i % 3])
    # A giant mug of coffee, a pencil and a ruler on the floor.
    mesh_object(zone, 'mug', cylinder(3.2, 7.5, 40), (-22, 21, 3.75), 'mug')
    mesh_object(zone, 'mug_coffee', cylinder(2.9, 0.02, 40), (-22, 21, 7.5 + PROUD), 'coffee')
    handle = torus(1.8, 0.45, 32, 10)
    bmesh.ops.rotate(handle, verts=handle.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, 'X'))
    mesh_object(zone, 'mug_handle', handle, (-18.2, 21, 3.9), 'mug')
    body = cylinder(0.55, 15, 6)
    bmesh.ops.rotate(body, verts=body.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, 'Y'))
    mesh_object(zone, 'pencil', body, (-19.5, -24, 0.55), 'pencil')
    tip = cylinder(0.55, 2.2, 6, r_top=0.0)
    bmesh.ops.rotate(tip, verts=tip.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, 'Y'))
    mesh_object(zone, 'pencil_tip', tip, (-10.9, -24, 0.55), 'wood')
    mesh_object(zone, 'ruler', cuboid(2.4, 26, 0.18), (25, -4, 0.09), 'ruler')
    for i in range(26):
        mesh_object(zone, f'ruler_tick_{i}', box(0.6 if i % 5 else 1.1, 0.06, 0.02), (24.0 + (0.3 if i % 5 else 0.55), -16.5 + i,
                    0.18 + 0.01), 'graphite')


def server_column(zone, base, top):
    """A column of racks: four rack units around a core, floor to ceiling of the zone."""
    out = []
    rng = random.Random(2)
    z = base - 4
    i = 0
    while z < top:
        h = rng.uniform(6, 9)
        # A millimetre between one rack and the next: butted faces can overlap by a rounding in the file's 32-bit floats.
        b = (-2.0 + 1.0, -2.0 + 1.0, z, 2.0 + 1.0, 2.0 + 1.0, min(top, z + h - 0.001))
        name = f'rack_column_{i}'
        make_prop(zone, name, prop_rack, b, rng)
        collider(zone, name, b)
        out.append(b)
        z += h
        i += 1
    return out


HALL = 58.0  # the server hall's floor reaches this far from the middle (the workshop's roof is its middle)


def prop_hall_rack(zone, name, b, rng, facing):
    """A rack tower in the hall: its front's units and vents are its texture; short bars of status lights sit here and there
    on the side that faces the climb (`facing`: 'x0', 'x1', 'y0' or 'y1'), and a blue cable bundle runs up one corner."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, 'rack')
    along_y = facing in ('x0', 'x1')
    plane = {'x0': x0, 'x1': x1, 'y0': y0, 'y1': y1}[facing]
    out = -1 if facing in ('x0', 'y0') else 1
    lo, hi = sorted((plane, plane + out * 0.05))
    # Each bar in a column of its own (two in one place would flicker).
    for k, t in enumerate(rng.sample([0.5 + 0.35 * i for i in range(8)], rng.randint(4, 7))):
        za = rng.uniform(z0 + 2, z1 - 6)
        zb = za + rng.uniform(1.0, 4.0)
        led = rng.choice(LEDS)
        if along_y:
            detail(zone, name, f'led{k}', (lo, y0 + t, za, hi, y0 + t + 0.12, zb), led)
        else:
            detail(zone, name, f'led{k}', (x0 + t, lo, za, x0 + t + 0.12, hi, zb), led)
    corner = rng.choice((0.25, 3.75))
    at = (plane + out * 0.25, y0 + corner) if along_y else (x0 + corner, plane + out * 0.25)
    add(cylinder(0.2, z1 - z0 - 0.2, 8), (at[0], at[1], (z0 + z1) / 2), 'cable-blue')


def server_hall(zone, base, top):
    """The hall round the stack: a raised floor out from the workshop's roof, two rings of rack towers in rows with aisles
    between, cable trays bridging the aisles and cables slung between the towers. Scenery only, well outside the route."""
    rng = random.Random(6)
    lo = CEILING[1]
    # The floor round the workshop's roof (which ends at the walls' outer faces, 33 m out).
    edge = 33.01
    for i, (x0, y0, x1, y1) in enumerate(((-HALL, edge, HALL, HALL), (-HALL, -HALL, HALL, -edge),
                                          (-HALL, -edge, -edge, edge), (edge, -edge, HALL, edge))):
        mesh_object(zone, f'hall_floor_{i}', cuboid(x1 - x0, y1 - y0, 1.0), ((x0 + x1) / 2, (y0 + y1) / 2, lo - 0.5),
                    'hall-floor')
    towers = []
    for ring in (24.0, 36.0):
        # Rows along x on two sides, rows along y on the other two, a rack every 4.6 m with a gap here and there.
        for side in (-1, 1):
            y = side * ring
            for x in [i * 4.6 for i in range(-int(ring / 4.6) - 2, int(ring / 4.6) + 3)]:
                if abs(x) <= ring + 2 and rng.random() > 0.12:
                    towers.append(((x - 2, y - 2), 'y0' if side > 0 else 'y1'))
            x = side * ring
            for y in [i * 4.6 for i in range(-int((ring - 4) / 4.6), int((ring - 4) / 4.6) + 1)]:
                if rng.random() > 0.12:
                    towers.append(((x - 2, y - 2), 'x0' if side > 0 else 'x1'))
    for i, ((x, y), facing) in enumerate(towers):
        h = rng.uniform(45, 76)  # the tallest just into the sea of clouds above
        make_prop(zone, f'hall_rack_{i}', lambda z, n, b, r: prop_hall_rack(z, n, b, r, facing),
                  (x, y, lo, x + 4, y + 4, lo + h), rng)
    # Cable trays across the aisle between the rings, at heights along the climb, their ends inside the towers.
    for i in range(28):
        a = rng.uniform(0, 2 * math.pi)
        z = rng.uniform(base + 8, top + 10)
        c, s = math.cos(a), math.sin(a)
        if abs(c) > abs(s):
            x0, x1 = sorted((math.copysign(25.5, c), math.copysign(34.5, c)))
            y = rng.uniform(-18, 18)
            b = (x0, y - 0.7, z, x1, y + 0.7, z + 0.35)
        else:
            y0, y1 = sorted((math.copysign(25.5, s), math.copysign(34.5, s)))
            x = rng.uniform(-18, 18)
            b = (x - 0.7, y0, z, x + 0.7, y1, z + 0.35)
        make_prop(zone, f'hall_tray_{i}', prop_tray, b, rng)
    # Cables slung between neighbouring towers of the inner ring: chains of short pieces sagging in the middle.
    inner = [t for t in towers if max(abs(t[0][0] + 2), abs(t[0][1] + 2)) < 30]
    parts = []
    for i in range(24):
        (ax, ay), _ = rng.choice(inner)
        (bx_, by), _ = rng.choice(inner)
        p0 = Vector((ax + 2, ay + 2, rng.uniform(base + 10, top)))
        p1 = Vector((bx_ + 2, by + 2, p0.z + rng.uniform(-6, 6)))
        if (p1 - p0).length < 12 or (p1 - p0).length > 40:
            continue
        sag = (p1 - p0).length * 0.15
        n = 10
        pts = [p0.lerp(p1, k / n) - Vector((0, 0, sag * 4 * (k / n) * (1 - k / n))) for k in range(n + 1)]
        if any(math.hypot(q.x - 1, q.y - 1) < 20 for q in pts):
            continue  # it would cross the climb
        for k in range(n):
            seg = pts[k + 1] - pts[k]
            c = cylinder(0.16, seg.length + 0.1, 6)
            rot = Vector((0, 0, 1)).rotation_difference(seg.normalized()).to_matrix()
            bmesh.ops.rotate(c, verts=c.verts, cent=(0, 0, 0), matrix=rot)
            bmesh.ops.translate(c, vec=(pts[k] + pts[k + 1]) / 2, verts=c.verts)
            parts.append(c)
    merged(zone, 'hall_cables', parts, 'cable')


def antenna_mast(zone, base, top):
    """A white antenna mast with red bands, a gold satellite near its top (both solid), and two satellites far off."""
    out = []
    mast = (-1.5, 0.5, base - 6, -0.5, 1.5, top - 12)
    piece(zone, 'mast', mast, cuboid, 'paint')
    for i in range(int((mast[5] - mast[2]) / 8)):
        z = mast[2] + 4 + i * 8
        piece(zone, f'mast__band{i}', (mast[0] - 0.02, mast[1] - 0.02, z, mast[3] + 0.02, mast[4] + 0.02, z + 1.2), cuboid,
              'tool-red')
    collider(zone, 'mast', mast)
    out.append(mast)
    body = (-2.6, -0.6, top - 12, 0.6, 2.6, top - 9)
    piece(zone, 'satellite', body, cuboid, 'foil')
    for s in (-1, 1):
        piece(zone, f'satellite__wing{s}', (-1.0 + s * 3.4 - 1.6, 0.2, top - 10.6, -1.0 + s * 3.4 + 1.6, 1.8, top - 10.4),
              cuboid, 'panel')
    collider(zone, 'satellite', body)
    out.append(body)
    rng = random.Random(4)
    for k, (x, y, z) in enumerate(((-34, 18, base + 20), (30, -26, base + 50), (8, 44, base + 64))):
        satellite(zone, f'far_satellite_{k}', (x, y, z), 2.6, rng.uniform(0, math.pi), rng.uniform(-0.4, 0.4))
    # A weather balloon drifting past: a white envelope, its line and the box of instruments under it.
    bx_, by, bz = -46, -40, base + 38
    piece(zone, 'balloon', (bx_ - 7, by - 7, bz - 8, bx_ + 7, by + 7, bz + 8), lambda w, d, h: sphere(7, 3), 'balloon')
    piece(zone, 'balloon_line', (bx_ - 0.06, by - 0.06, bz - 20, bx_ + 0.06, by + 0.06, bz - 6.5),
          lambda w, d, h: cylinder(0.06, h, 6), 'cable')
    piece(zone, 'balloon_payload', (bx_ - 0.8, by - 0.8, bz - 21.4, bx_ + 0.8, by + 0.8, bz - 20), cuboid, 'foil')
    return out


def posed(bm, rot, at):
    """bm (made about its middle) turned by the 3 x 3 matrix rot about that middle, then moved to `at`."""
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
    bmesh.ops.translate(bm, vec=at, verts=bm.verts)
    return bm


def assembly(zone, name, at, rot, parts):
    """A model made of (bm made about its middle, offset from the model's middle, material) parts, turned by rot and placed
    at `at`: one mesh per material, named <name> and <name>__<material> (so a SKY_ model stays the sky's)."""
    global GATHER
    GATHER = {}
    for bm, off, mat in parts:
        add(posed(bm, rot, (0, 0, 0)), Vector(at) + rot @ Vector(off), mat)
    gathered, GATHER = GATHER, None
    for i, (mat, bm) in enumerate(gathered.items()):
        mesh_object(zone, name if i == 0 else f'{name}__{mat}', bm, (0, 0, 0), mat)


def turned(bm, axis, angle=90):
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(angle), 3, axis))
    return bm


def satellite(zone, name, at, s, yaw, tilt):
    """A satellite about s metres across its body: gold foil, two wings of solar cells on silver arms, a white dish and a
    thin antenna."""
    parts = [(cuboid(s, s, s * 1.2), (0, 0, 0), 'foil')]
    for side in (-1, 1):
        parts.append((box(s * 0.75, s * 0.08, s * 0.08), (side * (s * 0.5 + s * 0.3), 0, 0), 'panel-frame'))
        parts.append((box(s * 2.6, s * 1.1, s * 0.04), (side * (s * 0.5 + s * 0.6 + s * 1.3), 0, 0), 'panel'))
    parts.append((cylinder(s * 0.08, s * 0.2, 16, r_top=s * 0.5), (0, 0, s * 0.7), 'paint'))
    parts.append((cylinder(s * 0.025, s * 0.9, 6), (s * 0.3, s * 0.3, -s * 1.0), 'panel-frame'))
    rot = Matrix.Rotation(yaw, 3, 'Z') @ Matrix.Rotation(tilt, 3, 'X')
    assembly(zone, name, at, rot, parts)


def cloud_puff(bm_parts, rng, cx, cy, cz, size, subdivisions=2, clear=0.0):
    """A cloud: a few round lumps, squashed and flat underneath, wrapped in one skin: each vertex of a sphere round the
    biggest lump's middle is pushed out to the farthest lump along its direction. One smooth outline with no seams where
    the lumps meet, for fewer vertices than the lumps as spheres of their own. No lump nearer the middle than `clear`."""
    lumps = []
    for i in range(rng.randint(4, 7)):
        r = size * rng.uniform(0.45, 0.8)
        p = Vector((cx + rng.uniform(-size, size), cy + rng.uniform(-size * 0.6, size * 0.6), cz + rng.uniform(0, size * 0.35)))
        if math.hypot(p.x, p.y) - r < clear:
            continue
        lumps.append((p, Vector((r, r, r * 0.7))))
    if not lumps:
        return
    c = max(lumps, key=lambda l: l[1].x)[0]
    floor = min(p.z for p, _ in lumps) - size * 0.15
    b = sphere(1.0, subdivisions)
    for v in b.verts:
        d = v.co.normalized()
        far = 0.0
        for p, radii in lumps:
            # The ray from c along d through the lump (a unit sphere once scaled by its radii): where it leaves.
            o = Vector(((c - p)[i] / radii[i] for i in range(3)))
            k = Vector((d[i] / radii[i] for i in range(3)))
            qa, qb, qc = k.dot(k), 2 * o.dot(k), o.dot(o) - 1
            disc = qb * qb - 4 * qa * qc
            if disc >= 0:
                far = max(far, (-qb + math.sqrt(disc)) / (2 * qa))
        q = c + d * far
        if q.z < floor:
            q.z = floor - (floor - q.z) * 0.25  # flatter underneath
        v.co = q
    # Smoothed a little: a ray that only grazes a far lump leaves a wedge.
    for _ in range(4):
        bmesh.ops.smooth_vert(b, verts=b.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm_parts.append(b)


def merged(zone, name, parts, mat, rounded=False, shadow=True):
    """One mesh from many bmeshes (all in world space)."""
    out = bmesh.new()
    for b in parts:
        tmp = bpy.data.meshes.new('merge')
        b.to_mesh(tmp)
        b.free()
        out.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    return mesh_object(zone, name, out, (0, 0, 0), mat, shadow=shadow, rounded=rounded)


CLEAR = 19.0  # nothing far off comes nearer the middle than this: the climbs of zones 2 to 4 keep inside it


def cloud_far(zone, base, top, rng):
    """Clouds all round the cloud zone, a sea of them below it (the server hall's towers rise through it, with a hole round
    the climb), streams of glowing data rising far out, and a few data blocks. Scenery only."""
    parts = []
    for i in range(18):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(26, 55)
        cloud_puff(parts, rng, math.cos(a) * r, math.sin(a) * r, rng.uniform(base - 10, top), rng.uniform(3, 6), 3,
                   clear=CLEAR)
    # The sea: rings of puffs out to the fog, close enough to run together, larger and coarser further out.
    for r0, count, size, sub in ((22, 16, (5, 8), 3), (38, 22, (7, 11), 3), (60, 26, (10, 15), 2), (90, 30, (14, 20), 2)):
        for i in range(count):
            a = 2 * math.pi * (i + rng.uniform(-0.3, 0.3)) / count
            r = r0 + rng.uniform(0, 12)
            cloud_puff(parts, rng, math.cos(a) * r, math.sin(a) * r, base - rng.uniform(13, 18), rng.uniform(*size), sub,
                       clear=CLEAR)
    # The clouds cast no shadow: on their own coarse spheres it falls in facets (the sun's shadow map sees the flat faces
    # the smooth shading hides).
    merged(zone, 'clouds', parts, 'cloud', rounded=True, shadow=False)
    # Data rising: a few spirals of small glowing cubes far out.
    bits = []
    for s in range(4):
        a0 = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(30, 46)
        z = base - 12
        k = 0
        while z < top - 4:
            a = a0 + k * 0.22
            p = (math.cos(a) * (r + 2.2 * math.sin(k * 0.7)), math.sin(a) * (r + 2.2 * math.sin(k * 0.7)), z)
            c = box(0.4, 0.4, 0.4)
            bmesh.ops.translate(c, vec=p, verts=c.verts)
            bits.append(c)
            z += rng.uniform(1.2, 2.4)
            k += 1
    merged(zone, 'data_streams', bits, 'data-bit')
    for i in range(10):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(24, 40)
        z = rng.uniform(base, top)
        s = rng.uniform(1.0, 3.0)
        x, y = math.cos(a) * r, math.sin(a) * r
        make_prop(zone, f'far_block_{i}', prop_data, (x - s, y - s, z - s, x + s, y + s, z + s), rng)


EARTH_RADIUS = 1600.0
EARTH_CENTRE = (0.0, 0.0, -1780.0)  # its top 180 m under the floor: far below the upper zones, with the horizon curving


def earth(zone):
    """The Earth far below the upper air: a smooth sphere painted with oceans, continents, ice and cloud (earth_texture).
    Sky: drawn without fog."""
    bm = bmesh.new()
    bm.loops.layers.uv.verify()  # calc_uvs fills a UV layer that must already be there
    bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=48, radius=EARTH_RADIUS, calc_uvs=True)
    in_order(bm)
    # Tipped over, so the climb looks down on land and sea at middle latitudes, not on the North Pole's ice.
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(62), 3, 'X'))
    bmesh.ops.translate(bm, vec=EARTH_CENTRE, verts=bm.verts)
    mesh_object(zone, 'SKY_earth', bm, (0, 0, 0), 'earth')


def space(zone, base):
    """Orbit's sky: stars on a great sphere round the zone, and the Moon. Sky: drawn without fog."""
    rng = random.Random(9)
    parts = []
    centre_z = base + 30
    for i in range(420):
        n = Vector((rng.gauss(0, 1), rng.gauss(0, 1), abs(rng.gauss(0, 1)) * 0.9 + 0.1)).normalized()
        p = Vector((0, 0, centre_z)) + n * 700
        b = sphere(rng.uniform(0.8, 2.2), 0)
        bmesh.ops.translate(b, vec=p, verts=b.verts)
        parts.append(b)
    merged(zone, 'SKY_stars', parts, 'star')
    moon = sphere(70, 3)
    mesh_object(zone, 'SKY_moon', moon, (420, 300, centre_z + 160), 'moon')
    ringed_planet(zone, (-380, -300, centre_z + 10))  # just over the horizon from the climb
    station(zone, (260, -250, centre_z + 40))
    ship(zone, (-150, 320, centre_z - 10))
    satellite(zone, 'SKY_satellite_0', (90, 150, centre_z - 20), 4.0, 0.7, 0.3)
    satellite(zone, 'SKY_satellite_1', (-170, 40, centre_z + 50), 4.0, 2.1, -0.5)


def asteroid_field(zone, base, top):
    """Rocks all round orbit, small ones near and a few great ones far out. Scenery only, clear of the climb and the ring."""
    rng = random.Random(11)
    for i in range(70):
        a = rng.uniform(0, 2 * math.pi)
        far = i < 10
        r = rng.uniform(70, 120) if far else rng.uniform(30, 75)
        size = rng.uniform(10, 22) if far else rng.uniform(1.0, 5.5) * (1 + r / 75)
        z = rng.uniform(base - 20, top + 80) if far else rng.uniform(base - 2, top + 50)
        mesh_object(zone, f'far_rock_{i}', rock(size, rng), (math.cos(a) * r, math.sin(a) * r, z),
                    'rock-dark' if rng.random() < 0.35 else 'rock', rounded=True)


def washer(r0, r1, t, segments=128):
    """A flat ring from radius r0 to r1, t thick, closed (seen from both sides)."""
    bm = bmesh.new()
    loops = []
    for rr, zz in ((r0, -t / 2), (r1, -t / 2), (r1, t / 2), (r0, t / 2)):
        loops.append([bm.verts.new((rr * math.cos(2 * math.pi * i / segments), rr * math.sin(2 * math.pi * i / segments), zz))
                      for i in range(segments)])
    for k in range(4):
        a, b = loops[k], loops[(k + 1) % 4]
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def ringed_planet(zone, at):
    """A banded planet with rings in three shades, tilted, far out in orbit's sky. Sky: drawn without fog."""
    tilt = Matrix.Rotation(math.radians(24), 3, 'X') @ Matrix.Rotation(math.radians(-30), 3, 'Y')
    bm = bmesh.new()
    bm.loops.layers.uv.verify()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=80, calc_uvs=True)
    in_order(bm)
    mesh_object(zone, 'SKY_planet', posed(bm, tilt, at), (0, 0, 0), 'planet')
    for name, r0, r1, mat in (('inner', 104, 130, 'ring-mid'), ('gap', 132, 139, 'ring-dark'),
                              ('outer', 141, 165, 'ring-light')):
        mesh_object(zone, f'SKY_planet_ring_{name}', posed(washer(r0, r1, 0.6), tilt, at), (0, 0, 0), mat)


def station(zone, at):
    """A space station: a long silver truss, three white modules across it, four pairs of solar wings and red lights at
    its ends."""
    parts = [(cuboid(80, 2.5, 2.5), (0, 0, 0), 'panel-frame')]
    for x in (-13, 0, 13):
        parts.append((turned(cylinder(4, 16, 24), 'X'), (x, 0, 0), 'hull'))
    parts.append((sphere(5.2, 2), (0, 0, 0), 'hull'))
    for x in (-37, -27, 27, 37):
        for y in (-17, 17):
            parts.append((cuboid(8, 28, 0.3), (x, y, 0), 'panel'))
        parts.append((box(0.8, 34, 0.8), (x, 0, 0), 'panel-frame'))
    for x in (-7, 7):
        parts.append((cuboid(9, 0.3, 6), (x, 0, 7), 'paint'))
    for x in (-40.2, 40.2):
        parts.append((box(1, 1, 1), (x, 0, 1.7), 'beacon-red'))
    rot = Matrix.Rotation(0.6, 3, 'Z') @ Matrix.Rotation(0.25, 3, 'X')
    assembly(zone, 'SKY_station', at, rot, parts)


def ship(zone, at):
    """A small ship crossing far off: a white hull with a pointed nose, swept wings, and two engines glowing blue."""
    parts = [(turned(cylinder(2.2, 16, 16), 'Y'), (0, 0, 0), 'hull'),
             (turned(cylinder(2.2, 6, 16, r_top=0.2), 'Y'), (11, 0, 0), 'hull'),
             (cuboid(7, 15, 0.4), (-3, 0, -0.6), 'hull')]
    for y in (-3.2, 3.2):
        parts.append((turned(cylinder(1.1, 5, 12), 'Y'), (-7, y, 0), 'rack-dark'))
        parts.append((turned(cylinder(0.85, 0.3, 12), 'Y'), (-9.6, y, 0), 'engine'))
    rot = Matrix.Rotation(-0.9, 3, 'Z') @ Matrix.Rotation(0.12, 3, 'X')
    assembly(zone, 'SKY_ship', at, rot, parts)


# --------------------------------------------------------------------------------------------------------------- build

Z = []


def build():
    rng = random.Random(SEED)
    for spec in ZONES:
        Z.append(Zone(spec))
    course = Course(rng)

    # Zone 1's floor and the middle stack; the spawn on the floor, facing the first step.
    course.solids += workshop_floor(Z[0])
    spawn = (0.0, -15.0)
    empty(Z[0], 'SPAWN', (spawn[0], spawn[1], 0.0))
    # A low book on the floor by the spawn is the first step.
    first = bx(-1.5, -12.0, 0.0, 0.55, 2.8, 2.2)
    course.solids.append(first)
    course.steps.append((Z[0], 'block', first, {}))

    # The columns of the zones above (solid), placed before the walk so it goes round them.
    course.solids += server_column(Z[1], 70, 150)
    course.solids += antenna_mast(Z[3], 228, 300)
    cloud_far(Z[2], 150, 228, random.Random(5))
    server_hall(Z[1], 70, 150)
    earth(Z[3])
    space(Z[4], 300)
    asteroid_field(Z[4], 300, 345)

    last = walk(course, ZONES, first)
    Z[0].base = 0.0

    # The last platform and the ring above it, a jump away.
    for attempt in range(200):
        finish = next_step(course, ZONES[-1], last, 9999 + attempt, 'block')
        finish = bx(*centre(finish), finish[5] - 0.8, finish[5], 3.0, 3.0)
        if course.clear(finish) and gap(last, finish) <= MARGIN * reach(finish[5] - last[5]) * 0.95:
            break
    else:
        raise RuntimeError('no room for the last platform')
    course.solids.append(finish)
    course.steps.append((Z[4], 'block', finish, {}))
    fx, fy = centre(finish)
    mx, my = ZONES[-1]['middle']
    ox, oy = fx - mx, fy - my
    r = math.hypot(ox, oy) or 1.0
    # The ring hangs out from the platform, away from the middle, its near rim low enough to touch from a jump.
    ring_x = fx + ox / r * (RING_RADIUS * math.cos(RING_TILT) + 1.2)
    ring_y = fy + oy / r * (RING_RADIUS * math.cos(RING_TILT) + 1.2)
    ring_z = finish[5] + 2.2 + RING_RADIUS * math.sin(RING_TILT)
    goal = mesh_object(Z[4], 'GOAL', torus(RING_RADIUS, RING_TUBE), (ring_x, ring_y, ring_z), 'brass')
    yaw = math.atan2(oy, ox) - math.pi / 2
    goal.rotation_euler = (RING_TILT, 0, 0)
    goal.rotation_euler.rotate(Matrix.Rotation(yaw, 3, 'Z').to_euler())
    goal['ring_radius'] = RING_RADIUS
    goal['ring_tube'] = RING_TUBE

    # Every step as a COL_ box and its look; beacons at the start of each zone and every 24 steps.
    since = {}
    for zone, kind, b, extra in course.steps:
        zone.route += 1
        key = zone.spec['key']
        stem = {'fan': 'fan', 'mover': 'drift', 'crumble': 'crumble', 'beam': 'beam'}.get(kind, key)
        name = zone.unique(stem)
        if kind == 'fan':
            fn = prop_fan
        elif kind == 'beam':
            fn = BEAM_PROPS[key]
        elif kind == 'crumble':
            fn = prop_panel if key == 'upper' else prop_shard
        elif key == 'workshop' and b[5] - b[2] < 0.25:
            fn = prop_floppy
        else:
            fn = rng.choice(PROPS[key])
        make_prop(zone, name, fn, b, rng)
        collider(zone, name, b, route=zone.route, **extra)
        since[zone.n] = since.get(zone.n, 24)
        if kind == 'block' and since[zone.n] >= 24:
            course.beacons += 1
            cx, cy = centre(b)
            empty(zone, f'BEACON_{course.beacons}', (cx, cy, b[5]), beacon=course.beacons)
            since[zone.n] = 0
        else:
            since[zone.n] += 1

    for i, zone in enumerate(Z):
        top = ZONES[i]['top'] if i < len(Z) - 1 else ring_z + RING_RADIUS
        empty(zone, f'ZONE_{zone.n}', (0, 0, zone.base), zone=zone.n, title=zone.spec['title'], base=round(zone.base, 2),
              top=round(top, 2), style='lit')
    bpy.context.view_layer.update()
    return course


# ------------------------------------------------------------------------------------------------------------- export

RAW_DIR = os.path.join(OUT_DIR, 'raw')
# gltfpack (a dev dependency): meshopt compression of the vertices and indices; nodes, materials and custom properties kept as
# they are (the level contract needs every name); positions as floats rounded to 16 bits (each mesh is about its own middle,
# so that is under a millimetre; a collision box's size and place are its node's, which are exact); texture coordinates as
# floats (they are in world metres, which 12 bits would blur); normals in 8 bits. The game decodes it with three.js's
# MeshoptDecoder (gltf-level.ts).
PACK = ['-cc', '-kn', '-km', '-ke', '-vpf', '-vp', '16', '-vtf']


def pack(raw, out):
    """Compress the exported raw .glb into the game's assets with gltfpack, run through npx from the repository."""
    npx = shutil.which('npx') or shutil.which('npx.cmd')
    if not npx:
        raise SystemExit('build_climb.py needs Node (npx) on the PATH to compress the zones with gltfpack: npm install first')
    subprocess.run([npx, '--no-install', 'gltfpack', '-i', raw, '-o', out, *PACK], cwd=ROOT, check=True)


def merge_static(zone):
    """Join the zone's scenery that never moves into one mesh per material (and per whether it casts a shadow), as the game
    draws it anyway: a file of a few dozen meshes instead of hundreds is far smaller (each mesh is its own entry in the file's
    index). The collision boxes, the goal, the sky's meshes and the scenery of a drifting or crumbling box stay as they are."""
    moving = {o.name[len('COL_'):] for o in zone.collection.objects
              if o.name.startswith('COL_') and ('mover' in o or 'crumble' in o)}
    groups = {}
    for o in zone.collection.objects:
        if o.type != 'MESH' or o.name.startswith(('COL_', 'SKY_', 'GOAL')) or o.name.split('__')[0] in moving:
            continue
        key = (o.data.materials[0].name if o.data.materials else '', int(o.get('shadow', 1)))
        groups.setdefault(key, []).append(o)
    dg = bpy.context.evaluated_depsgraph_get()
    for (mat, shadow), objs in groups.items():
        # The smooth normals are a modifier's: made real first, so the join keeps them.
        for o in objs:
            mesh = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
            old = o.data
            o.modifiers.clear()
            o.data = mesh
            bpy.data.meshes.remove(old)
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        objs[0].name = f'z{zone.n}_scenery__{mat}' + ('' if shadow else '__noshadow')


def export():
    os.makedirs(ASSETS, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)
    for zone in Z:
        merge_static(zone)
    for zone in Z:
        for o in bpy.context.scene.objects:
            o.select_set(False)
        for o in zone.collection.objects:
            o.select_set(True)
        path = os.path.join(RAW_DIR, f'zone-{zone.n}.glb')
        options = dict(
            filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
            export_texcoords=True, export_normals=True, export_tangents=False, export_materials='EXPORT',
            export_attributes=False, export_cameras=False, export_lights=False, export_extras=True,
            export_animations=False, export_draco_mesh_compression_enable=False, export_image_format='WEBP',
        )
        try:
            bpy.ops.export_scene.gltf(export_vertex_color='NONE', **options)
        except TypeError:
            bpy.ops.export_scene.gltf(**options)
        pack(path, os.path.join(ASSETS, f'zone-{zone.n}.glb'))


def manifest():
    """climb.json: the zones and the ring, in the game's axes (Blender's (x, y, z) is the game's (x, z, -y))."""
    zones = []
    for zone in Z:
        e = bpy.data.objects[f'ZONE_{zone.n}']
        look = dict(LOOKS[zone.spec['key']])
        x, y, z = look.pop('sun_dir')
        length = math.sqrt(x * x + y * y + z * z)
        look['sun_dir'] = [round(x / length, 4), round(z / length, 4), round(-y / length, 4)]
        zones.append({'n': zone.n, 'title': e['title'], 'base': e['base'], 'top': e['top'],
                      'file': f'zone-{zone.n}.glb', 'look': look})
    g = bpy.data.objects['GOAL'].location
    data = {'zones': zones, 'goal': {'x': round(g.x, 4), 'y': round(g.z, 4), 'z': round(-g.y, 4)}}
    with open(os.path.join(ASSETS, 'climb.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=2)
        f.write('\n')


def report(course):
    total = 0
    for zone in Z:
        objs = list(zone.collection.objects)
        meshes = [o for o in objs if o.type == 'MESH']
        cols = [o for o in meshes if o.name.startswith('COL_')]
        kinds = {}
        for z, kind, _, _ in course.steps:
            if z is zone:
                kinds[kind] = kinds.get(kind, 0) + 1
        tris = sum(len(p.vertices) - 2 for o in meshes if o not in cols for p in o.data.polygons)
        size = os.path.getsize(os.path.join(ASSETS, f'zone-{zone.n}.glb'))
        total += zone.route
        print(f'ZONE {zone.n} {zone.spec["title"]:13s} base {zone.base:6.1f} m  {zone.route:3d} steps {kinds}  '
              f'{len(meshes) - len(cols)} meshes, {tris} triangles, {size} bytes')
    print(f'CLIMB: {total} steps, {course.beacons} beacons')


# ------------------------------------------------------------------------------------------------------------- preview
#
# Stills for the author's approval, as the game will draw them: EEVEE, each zone under its own sky colour and sun (LOOKS), the
# materials as they are (lights and screens glowing). No fog, and the sky is one colour here (the game shades it from the
# horizon up). Written to tools/ascent/out/ (not in git), with the .blend.

def preview(course):
    import numpy as np

    os.makedirs(OUT_DIR, exist_ok=True)
    scene = bpy.context.scene
    for o in scene.objects:
        if o.name.startswith('COL_'):
            o.hide_render = True
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, 'climb.blend'))

    for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.view_settings.view_transform = 'Standard'  # colours as authored, as the game draws them
    world = bpy.data.worlds.new('preview')
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    sun_data = bpy.data.lights.new('sun', 'SUN')
    sun_data.angle = math.radians(2)
    sun_data.use_shadow = False  # the game draws no shadow maps (the blob under the agent is its one shadow)
    sun = bpy.data.objects.new('sun', sun_data)
    scene.collection.objects.link(sun)
    cam_data = bpy.data.cameras.new('cam')
    cam_data.clip_end = 5000
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def light(key):
        look = LOOKS[key]
        c = srgb(look['horizon'])
        bg.inputs[0].default_value = c
        bg.inputs[1].default_value = look['ambient']
        sun_data.color = srgb(look['sun'])[:3]
        sun_data.energy = look['strength']
        sun.rotation_euler = Vector(look['sun_dir']).normalized().to_track_quat('Z', 'Y').to_euler()

    def shoot(path, pos, target, lens, size):
        cam.location = pos
        cam.rotation_euler = (Vector(target) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        cam_data.lens = lens
        scene.render.resolution_x, scene.render.resolution_y = size
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        return path

    def sheet(paths, out_path):
        tiles = []
        for p in paths:
            img = bpy.data.images.load(p)
            w, h = img.size
            tiles.append(np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4))
            bpy.data.images.remove(img)
        grid = np.concatenate(tiles, axis=1)
        out = bpy.data.images.new('sheet', grid.shape[1], grid.shape[0], alpha=False)
        out.pixels = grid.ravel().tolist()
        out.filepath_raw = out_path
        out.file_format = 'PNG'
        out.save()
        print(f'PREVIEW -> {out_path}')

    tiles = os.path.join(OUT_DIR, 'tiles')
    os.makedirs(tiles, exist_ok=True)
    for zone in Z:
        light(zone.spec['key'])
        steps = [b for z, _, b, _ in course.steps if z is zone]
        base, ztop = zone.base, max(b[5] for b in steps)
        mid = (base + ztop) / 2
        mx, my = zone.spec['middle']
        a = shoot(os.path.join(tiles, f'zone-{zone.n}-out.png'), (mx + 34, my - 40, mid + 12), (mx, my, mid - 2), 24,
                  (960, 720))
        if zone is Z[-1]:
            here = steps[-4]
            ring = bpy.data.objects['GOAL'].location
            ax, ay, az = ring.x, ring.y, ring.z - 1.5
        else:
            i = len(steps) // 3
            here, ahead = steps[i], steps[min(i + 3, len(steps) - 1)]
            ax, ay = centre(ahead)
            az = ahead[5] + 0.5
        hx, hy = centre(here)
        d = Vector((ax - hx, ay - hy, 0))
        d = d.normalized() if d.length > 1e-6 else Vector((0, 1, 0))
        eye = Vector((hx, hy, here[5])) - d * 5.7 + Vector((0, 0, 3.2))
        b = shoot(os.path.join(tiles, f'zone-{zone.n}-play.png'), eye, (ax, ay, az), 20, (960, 720))
        sheet([a, b], os.path.join(OUT_DIR, f'style-zone-{zone.n}.png'))


def main():
    reset_scene()
    course = build()
    export()
    manifest()
    report(course)
    if '--preview' in ARGS:
        preview(course)


main()
