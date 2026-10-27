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
#   3 cloud          soft data blocks in open air                                            blocks that drift
#   4 upper air      solar panels, girders and satellites round an antenna mast              plates that crumble, thin beams
#   5 orbit          shards rising to the brass ring                                         drifts, crumbles, beams; the ring
#
# The contract with the game (level.ts, gltf-level.ts), on top of build_test_climb.py's (COL_ boxes, route, ground, SPAWN,
# GOAL, the four material names):
#
#   ZONE_<n>          an empty in each file: zone = n, title, base and top (metres, Blender's z)
#   COL_<name>        route = n numbers each file's blocks from 1; the files join in zone order
#     fan = h         an updraft over the box, h metres high; strength = its upward push (m/s²)
#     mover = 1       the box drifts to (move_x, move_y, move_z) from where it is (Blender axes) and back, every period s
#     crumble = s     the box breaks s seconds after the agent first stands on it, and comes back a little later
#   <name>, <name>__* scenery that goes with COL_<name> (it moves or falls with it)
#   BEACON_<n>        an empty: an assist-mode checkpoint (beacon = n, in climbing order), where the agent's feet go
#   GOAL              the ring (zone 5); ring_radius and ring_tube give its size: touching it finishes the climb
#
#   climb.json        beside the .glb files: each zone's title, base and top, and where the ring is (game axes), so the HUD's
#                     altimeter and the goal are known before the top zones load
#
# Blender works Z up; the glTF exporter turns that into +Y up and Blender's +Y into -Z. Sizes are metres at the agent's scale
# (1.2 m tall). Custom properties are not turned by the exporter: move_x/y/z stay in Blender's axes (level.ts turns them).

import json
import math
import os
import random
import sys

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


# Preview tones only (tokens.css); the game reads the tokens themselves. (top, sides along x, sides along y, bottom)
PREVIEW_TONES = {
    'obsidian': ('#1b1b1f', '#151518', '#0f0f11', '#020203'),
    'obsidian-dark': ('#151518', '#0f0f11', '#0f0f11', '#020203'),
    'brass': ('#c9a96a',) * 4,
    'ivory': ('#ece6d8',) * 4,
}
BG = '#09090a'
IVORY = '#ece6d8'

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
    if name not in MATERIALS:
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = srgb(PREVIEW_TONES[name][0])
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


def mesh_object(zone, name, bm, location, mat):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = zone.link(bpy.data.objects.new(name, mesh))
    obj.location = location
    mesh.materials.append(material(mat))
    return obj


def cuboid(w, d, h):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    return bm


def chamfered(w, d, h, c):
    bm = cuboid(w, d, h)
    bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=c, segments=1, profile=0.5, affect='EDGES',
                    clamp_overlap=True)
    return bm


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


def piece(zone, name, b, bm_fn, mat='obsidian'):
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
    obj = mesh_object(zone, f'COL_{name}', cuboid(w, d, h), (cx, cy, (b[2] + b[5]) / 2), 'obsidian')
    obj.data.materials.clear()
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

def detail(zone, name, part, b, mat='obsidian', bm_fn=cuboid):
    return piece(zone, f'{name}__{part}', b, bm_fn, mat)


def prop_book(zone, name, b, rng):
    """A giant book lying flat: covers top and bottom, the pages inset a little on three sides."""
    x0, y0, z0, x1, y1, z1 = b
    t = min(0.08, (z1 - z0) * 0.15)
    piece(zone, name, (x0, y0, z1 - t, x1, y1, z1), cuboid)
    detail(zone, name, 'back', (x0, y0, z0, x1, y1, z0 + t))
    spine_left = rng.random() < 0.5
    inset = 0.06
    pages = (x0 if spine_left else x0 + inset, y0 + inset, z0 + t, x1 - inset if spine_left else x1, y1 - inset, z1 - t)
    detail(zone, name, 'pages', pages, 'obsidian-dark')
    spine = (x0, y0, z0 + t, x0 + 0.05, y1, z1 - t) if spine_left else (x1 - 0.05, y0, z0 + t, x1, y1, z1 - t)
    detail(zone, name, 'spine', spine)


def prop_case(zone, name, b, rng):
    """A toolbox or a PC case: a box with a lid line and two latches on one side."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid)
    zl = z1 - (z1 - z0) * 0.28
    detail(zone, name, 'lid', (x0 - 0.02, y0 - 0.02, zl - 0.03, x1 + 0.02, y1 + 0.02, zl))
    for f in (0.3, 0.7):
        x = x0 + (x1 - x0) * f
        detail(zone, name, f'latch{int(f * 10)}', (x - 0.09, y0 - 0.05, zl - 0.14, x + 0.09, y0, zl + 0.06))


def prop_chip(zone, name, b, rng):
    """A giant chip: a dark body with rows of pins down two sides."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, 'obsidian-dark')
    n = max(3, int((y1 - y0) / 0.32))
    for i in range(n):
        y = y0 + (i + 0.5) * (y1 - y0) / n
        for side, (a0, a1) in (('l', (x0 - 0.12, x0)), ('r', (x1, x1 + 0.12))):
            detail(zone, name, f'pin{side}{i}', (a0, y - 0.05, z0, a1, y + 0.05, z0 + (z1 - z0) * 0.6))


def prop_floppy(zone, name, b, rng):
    """A floppy disk: a thin plate with the metal shutter flush with the top (ivory) and a label."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid)
    w = x1 - x0
    detail(zone, name, 'shutter', (x0 + w * 0.3, y1 - (y1 - y0) * 0.38, z1 - 0.01, x1 - w * 0.3, y1 - 0.02, z1), 'ivory')


def prop_rack(zone, name, b, rng):
    """A rack unit: a box with strips proud of each side, like a stack of servers."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid)
    rows = min(8, max(2, int((z1 - z0) / 0.22)))  # a tall column gets a few strips, not dozens
    for i in range(rows):
        z = z0 + (i + 0.5) * (z1 - z0) / rows
        detail(zone, name, f'u{i}', (x0 + 0.08, y0 - 0.03, z - 0.035, x1 - 0.08, y0, z + 0.035), 'obsidian-dark')
        detail(zone, name, f'v{i}', (x0 + 0.08, y1, z - 0.035, x1 - 0.08, y1 + 0.03, z + 0.035), 'obsidian-dark')


def prop_heatsink(zone, name, b, rng):
    """A heat sink: a base plate and fins up to the top, along its longer side."""
    x0, y0, z0, x1, y1, z1 = b
    base = z0 + (z1 - z0) * 0.35
    piece(zone, name, (x0, y0, z0, x1, y1, base), cuboid)
    along_x = (x1 - x0) >= (y1 - y0)
    n = max(4, int(((y1 - y0) if along_x else (x1 - x0)) / 0.22))
    for i in range(n):
        if along_x:
            y = y0 + (i + 0.5) * (y1 - y0) / n
            detail(zone, name, f'fin{i}', (x0, y - 0.04, base, x1, y + 0.04, z1))
        else:
            x = x0 + (i + 0.5) * (x1 - x0) / n
            detail(zone, name, f'fin{i}', (x - 0.04, y0, base, x + 0.04, y1, z1))


def prop_tray(zone, name, b, rng):
    """A cable tray: a beam with rails flush with the top along both long edges."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, 'obsidian-dark')
    if (x1 - x0) >= (y1 - y0):
        detail(zone, name, 'rail_a', (x0, y0 - 0.04, z0, x1, y0, z1))
        detail(zone, name, 'rail_b', (x0, y1, z0, x1, y1 + 0.04, z1))
    else:
        detail(zone, name, 'rail_a', (x0 - 0.04, y0, z0, x0, y1, z1))
        detail(zone, name, 'rail_b', (x1, y0, z0, x1 + 0.04, y1, z1))


def prop_fan(zone, name, b, rng):
    """A case fan lying on its back: a square housing, a ring and three blades under the top."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, (x0, y0, z0, x1, y1, z0 + 0.12), cuboid)
    w = x1 - x0
    for i, (a0, a1, b0, b1) in enumerate(((x0, x0 + 0.14, y0, y1), (x1 - 0.14, x1, y0, y1),
                                          (x0, x1, y0, y0 + 0.14), (x0, x1, y1 - 0.14, y1))):
        detail(zone, name, f'frame{i}', (a0, b0, z0 + 0.12, a1, b1, z1))
    cx, cy = centre(b)
    add(cylinder(w * 0.44, 0.06, 32), (cx, cy, z1 - 0.03), 'obsidian')
    add(cylinder(w * 0.12, (z1 - z0) - 0.16, 16), (cx, cy, (z0 + z1) / 2 + 0.04), 'obsidian-dark')
    for i in range(3):
        blade = cuboid(w * 0.36, 0.14, 0.03)
        bmesh.ops.translate(blade, vec=(w * 0.2, 0, 0), verts=blade.verts)
        bmesh.ops.rotate(blade, verts=blade.verts, matrix=Matrix.Rotation(2 * math.pi * i / 3 + 0.3, 3, 'Z'))
        add(blade, (cx, cy, z1 - 0.12), 'obsidian-dark')


def prop_data(zone, name, b, rng):
    """A data block in the cloud: a soft, chamfered cube with a few bits standing out of its sides."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, lambda w, d, h: chamfered(w, d, h, min(w, d, h) * 0.12))
    for i in range(rng.randint(1, 3)):
        side = rng.choice(('x0', 'x1', 'y0', 'y1'))
        z = rng.uniform(z0 + 0.15, z1 - 0.2)
        s = rng.uniform(0.12, 0.22)
        if side[0] == 'x':
            x = x0 if side == 'x0' else x1
            y = rng.uniform(y0 + 0.2, y1 - 0.2)
            box = (x - 0.08, y - s, z - s, x + 0.08, y + s, z + s)
        else:
            y = y0 if side == 'y0' else y1
            x = rng.uniform(x0 + 0.2, x1 - 0.2)
            box = (x - s, y - 0.08, z - s, x + s, y + 0.08, z + s)
        detail(zone, name, f'bit{i}', box, 'obsidian-dark')


def prop_panel(zone, name, b, rng):
    """A solar panel: a thin plate, its cells marked by strips flush with the top."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid, 'obsidian-dark')
    for i in range(1, 3):
        x = x0 + (x1 - x0) * i / 3
        detail(zone, name, f'gx{i}', (x - 0.025, y0, z1 - 0.02, x + 0.025, y1, z1))
        y = y0 + (y1 - y0) * i / 3
        detail(zone, name, f'gy{i}', (x0, y - 0.025, z1 - 0.02, x1, y + 0.025, z1))


def prop_girder(zone, name, b, rng):
    """A girder: a beam with short ribs down its sides."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, cuboid)
    along_x = (x1 - x0) >= (y1 - y0)
    length = (x1 - x0) if along_x else (y1 - y0)
    n = max(2, int(length / 0.8))
    for i in range(n):
        f = (i + 0.5) / n
        if along_x:
            x = x0 + (x1 - x0) * f
            detail(zone, name, f'rib{i}', (x - 0.04, y0 - 0.05, z0 - 0.15, x + 0.04, y1 + 0.05, z1 - 0.02))
        else:
            y = y0 + (y1 - y0) * f
            detail(zone, name, f'rib{i}', (x0 - 0.05, y - 0.04, z0 - 0.15, x1 + 0.05, y + 0.04, z1 - 0.02))


def prop_shard(zone, name, b, rng):
    """A shard of rock in orbit: a chamfered block with a smaller one sunk into its side."""
    x0, y0, z0, x1, y1, z1 = b
    piece(zone, name, b, lambda w, d, h: chamfered(w, d, h, min(w, d, h) * 0.2))
    cx, cy = centre(b)
    s = min(x1 - x0, y1 - y0) * 0.35
    dz = (z1 - z0) * 0.4
    detail(zone, name, 'chip', (cx - s, cy - s, z0 - dz, cx + s, cy + s, z0 + 0.1),
           'obsidian-dark', lambda w, d, h: chamfered(w, d, h, min(w, d, h) * 0.2))


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
    """The floor, and the stack of hardware in the middle: a PC case, a pile of manuals, a toolbox, a monitor."""
    mesh_object(zone, 'floor', cuboid(64, 64, 1), (0, 0, -0.5), 'obsidian-dark')
    collider(zone, 'floor', (-32, -32, -1, 32, 32, 0), ground=1)
    stack = [
        ('tower_case', (-2.6, -2.6, 0, 2.6, 2.6, 24), prop_case),
        ('manuals', (-3.2, -2.4, 24, 3.2, 2.4, 33), prop_book),
        ('toolchest', (-2.4, -2.9, 33, 2.4, 2.9, 47), prop_case),
        ('monitor', (-3.0, -1.0, 47, 3.0, 1.0, 66), prop_case),
    ]
    out = []
    rng = random.Random(1)
    for name, b, fn in stack:
        make_prop(zone, name, fn, b, rng)
        collider(zone, name, b)
        out.append(b)
    return out


def server_column(zone, base, top):
    """A column of racks: four rack units around a core, floor to ceiling of the zone."""
    out = []
    rng = random.Random(2)
    z = base - 4
    i = 0
    while z < top:
        h = rng.uniform(6, 9)
        b = (-2.0 + 1.0, -2.0 + 1.0, z, 2.0 + 1.0, 2.0 + 1.0, min(top, z + h))
        name = f'rack_column_{i}'
        make_prop(zone, name, prop_rack, b, rng)
        collider(zone, name, b)
        out.append(b)
        z += h
        i += 1
    return out


def antenna_mast(zone, base, top):
    """A thin antenna mast with a satellite near its top (both solid), and two satellites far off (scenery only)."""
    out = []
    mast = (-1.5, 0.5, base - 6, -0.5, 1.5, top - 12)
    make_prop(zone, 'mast', prop_girder, mast, random.Random(3))
    collider(zone, 'mast', mast)
    out.append(mast)
    body = (-2.6, -0.6, top - 12, 0.6, 2.6, top - 9)
    make_prop(zone, 'satellite', prop_case, body, random.Random(4))
    collider(zone, 'satellite', body)
    out.append(body)
    for k, (x, y, z) in enumerate(((-34, 18, base + 20), (30, -26, base + 50))):
        piece(zone, f'far_satellite_{k}', (x - 1.5, y - 1.5, z - 1.5, x + 1.5, y + 1.5, z + 1.5), cuboid)
        for s in (-1, 1):
            piece(zone, f'far_satellite_{k}__wing{s}', (x + s * 1.6, y - 1.0, z - 0.06, x + s * 6.5, y + 1.0, z + 0.06),
                  cuboid, 'obsidian-dark')
    return out


def cloud_far(zone, base, top, rng):
    """Data blocks far out in the open: scenery only, for depth."""
    for i in range(16):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(24, 40)
        z = rng.uniform(base, top)
        s = rng.uniform(1.0, 3.0)
        x, y = math.cos(a) * r, math.sin(a) * r
        piece(zone, f'far_block_{i}', (x - s, y - s, z - s, x + s, y + s, z + s),
              lambda w, d, h: chamfered(w, d, h, min(w, d, h) * 0.12))


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
              top=round(top, 2))
    bpy.context.view_layer.update()
    return course


# ------------------------------------------------------------------------------------------------------------- export

def export():
    os.makedirs(ASSETS, exist_ok=True)
    for zone in Z:
        for o in bpy.context.scene.objects:
            o.select_set(False)
        for o in zone.collection.objects:
            o.select_set(True)
        path = os.path.join(ASSETS, f'zone-{zone.n}.glb')
        options = dict(
            filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
            export_texcoords=False, export_normals=False, export_tangents=False, export_materials='EXPORT',
            export_attributes=False, export_cameras=False, export_lights=False, export_extras=True,
            export_animations=False, export_draco_mesh_compression_enable=False, export_image_format='NONE',
        )
        try:
            bpy.ops.export_scene.gltf(export_vertex_color='NONE', **options)
        except TypeError:
            bpy.ops.export_scene.gltf(**options)


def manifest():
    """climb.json: the zones and the ring, in the game's axes (Blender's (x, y, z) is the game's (x, z, -y))."""
    zones = []
    for zone in Z:
        e = bpy.data.objects[f'ZONE_{zone.n}']
        zones.append({'n': zone.n, 'title': e['title'], 'base': e['base'], 'top': e['top'],
                      'file': f'zone-{zone.n}.glb'})
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

def paint_tones():
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH' or obj.name.startswith('COL_') or not obj.data.materials:
            continue
        mat = obj.data.materials[0].name
        if mat not in PREVIEW_TONES:
            continue
        top, side_x, side_y, bottom = (Vector(srgb(c)[:3]) for c in PREVIEW_TONES[mat])
        attr = obj.data.color_attributes.new('tone', 'FLOAT_COLOR', 'CORNER')
        rot = obj.matrix_world.to_3x3()
        for poly in obj.data.polygons:
            n = (rot @ poly.normal).normalized()
            w = (abs(n.x), abs(n.y), max(n.z, 0), max(-n.z, 0))
            c = (side_x * w[0] + side_y * w[1] + top * w[2] + bottom * w[3]) / max(sum(w), 1e-6)
            for li in poly.loop_indices:
                attr.data[li].color = (c.x, c.y, c.z, 1.0)
        obj.data.color_attributes.active_color = attr


def edge_lines(width=0.03):
    """
    A thin bar on each edge the game draws (EdgesGeometry at 30 degrees) of every obsidian mesh, built as one mesh in one go
    (adding bars to a bmesh one by one gets slower with every bar).
    """
    verts, faces = [], []
    corners = [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]
    quads = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    for obj in list(bpy.context.scene.objects):
        if obj.type != 'MESH' or obj.name.startswith('COL_') or not obj.data.materials:
            continue
        if obj.data.materials[0].name not in ('obsidian', 'obsidian-dark'):
            continue
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.transform(obj.matrix_world)
        for e in bm.edges:
            if len(e.link_faces) == 2 and e.calc_face_angle(0) < math.radians(30):
                continue
            a, b = e.verts[0].co, e.verts[1].co
            d = b - a
            if d.length < 1e-5:
                continue
            m = (Matrix.Translation((a + b) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
                 @ Matrix.Diagonal((width / 2, width / 2, (d.length + width) / 2, 1)))
            base = len(verts)
            verts.extend(m @ Vector(c) for c in corners)
            faces.extend(tuple(base + k for k in q) for q in quads)
        bm.free()
    mesh = bpy.data.meshes.new('lines')
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    obj = bpy.data.objects.new('lines', mesh)
    bpy.context.scene.collection.objects.link(obj)
    attr = mesh.color_attributes.new('tone', 'FLOAT_COLOR', 'CORNER')
    line = srgb(IVORY)
    dim = tuple(line[i] * 0.55 + srgb(BG)[i] * 0.45 for i in range(3))
    for d in attr.data:
        d.color = (*dim, 1.0)
    mesh.color_attributes.active_color = attr
    return obj


def preview(course):
    import numpy as np

    os.makedirs(OUT_DIR, exist_ok=True)
    scene = bpy.context.scene
    for o in scene.objects:
        if o.name.startswith('COL_'):
            o.hide_render = True
    paint_tones()
    edge_lines()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, 'climb.blend'))

    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.view_settings.view_transform = 'Standard'
    shading = scene.display.shading
    shading.light = 'FLAT'
    shading.color_type = 'VERTEX'
    shading.background_type = 'WORLD'
    scene.world = bpy.data.worlds.new('preview')
    scene.world.color = srgb(BG)[:3]
    scene.display.render_aa = '8'
    cam_data = bpy.data.cameras.new('cam')
    cam_data.clip_end = 800
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

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
    # The whole climb, from far off.
    top = max(b[5] for _, _, b, _ in course.steps)
    shoot(os.path.join(OUT_DIR, 'climb-overview.png'), (95, -150, top * 0.55), (0, 0, top * 0.48), 24, (1000, 1500))
    print(f'PREVIEW -> {os.path.join(OUT_DIR, "climb-overview.png")}')

    for zone in Z:
        steps = [b for z, _, b, _ in course.steps if z is zone]
        base, ztop = zone.base, max(b[5] for b in steps)
        mid = (base + ztop) / 2
        mx, my = zone.spec['middle']
        # The zone from outside, then the player's view a third of the way up it.
        a = shoot(os.path.join(tiles, f'zone-{zone.n}-out.png'), (mx + 34, my - 40, mid + 12), (mx, my, mid - 2), 24,
                  (960, 720))
        if zone is Z[-1]:
            # The last zone: the last steps and the ring above them.
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
        sheet([a, b], os.path.join(OUT_DIR, f'zone-{zone.n}.png'))


def main():
    reset_scene()
    course = build()
    export()
    manifest()
    report(course)
    if '--preview' in ARGS:
        preview(course)


main()
