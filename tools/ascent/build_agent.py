# R7: Ascent's agent, the small robot the player climbs as, built from scratch and exported as
# src/game/ascent/assets/agent.glb (docs/ASCENT.md, "How it looks").
#
#   blender -b --factory-startup -P tools/ascent/build_agent.py              # the .glb only
#   blender -b --factory-startup -P tools/ascent/build_agent.py -- --preview # and stills in tools/ascent/out/
#
# Everything is made from numbers in this file, so the same Blender version gives the same file. It is a designer toy, not a
# realistic robot: a rounded, slightly boxy ivory head with one wide brass visor band across the front (the only brass on
# it), a short antenna with a ball on top, a compact ivory torso with an obsidian battery pack on its back (the camera sees it
# from behind most of the time, so the back carries character), short legs in chunky ivory boots and stubby ivory arms.
#
# Sizes are metres. It stands 1.2 m to the top of the antenna ball and 0.55 m across at its widest, so seen from behind it
# fits the collision box in src/game/ascent/config.ts (agent: 0.56 by 1.2). Blender works Z up with the agent facing +Y; the
# glTF exporter turns that into +Y up and -Z forward, the way the game's agent faces at yaw 0.
#
# Colour is the material's name, as in the levels: ivory, brass, obsidian, obsidian-dark; the game swaps each for its token
# colours (src/game/ascent/agent.ts). No textures or UVs. Unlike a level, the normals are in the file: the rounded parts are
# shaded smooth (flat facets made the robot read as flat panels), with edges sharper than SMOOTH_ANGLE kept sharp.
#
# Node names are the contract with agent.ts. Every origin is the part's pivot:
#   agent            the root, at the feet
#   body             the torso, pivot at the hips
#     pack           the battery pack on its back
#     joints         the waistband and the shoulder joints
#     neck
#     head           pivot at the neck
#       visor
#       antenna      pivot at its foot on the head
#         antenna_tip, antenna_base
#     arm_L, arm_R   pivot at the shoulder
#   leg_L, leg_R     pivot at the hip
#     foot_L, foot_R

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT_GLB = os.path.join(ROOT, 'src', 'game', 'ascent', 'assets', 'agent.glb')
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


# Preview colours only, copied from src/styles/design-system/tokens.css; the game reads the tokens themselves.
TOKENS = {
    'bg': '#09090a',        # --bg
    'face1': '#0f0f11',     # --surface-1
    'face2': '#151518',     # --surface-2
    'face3': '#1b1b1f',     # --surface-3
    'void': '#020203',      # --void
    'ivory': '#ece6d8',     # --text
    'brass': '#c9a96a',     # --brass
}
# Each material and the token it is drawn in (lit), as agent.ts does it.
MATERIAL_TONES = {'ivory': 'ivory', 'brass': 'brass', 'obsidian': 'face3', 'obsidian-dark': 'face2'}
# The parts the game outlines with ivory edge lines (agent.ts: the obsidian ones, as in the levels).
OUTLINED = {'obsidian', 'obsidian-dark'}

# The proportions. A variant (preview only) changes a few of these.
BASE = {
    # head: half width, half depth, height, corner radius in plan, how round the top and bottom are
    'head_hx': 0.245, 'head_hy': 0.21, 'head_h': 0.36, 'head_r': 0.10, 'head_round': 0.07,
    'head_z': 0.68,            # the neck: the head's pivot
    'visor_z': (0.13, 0.25),   # the band's bottom and top, above the head's pivot
    'torso_z': (0.24, 0.64),   # bottom and top of the torso
    'torso_hx': 0.17, 'torso_hy': 0.14,
    'hip_z': 0.30, 'hip_x': 0.095, 'leg_hx': 0.056,
    'shoulder_z': 0.565, 'shoulder_x': 0.215,
    'foot_hx': 0.07, 'foot_hy': 0.115, 'foot_h': 0.11, 'foot_dy': 0.03,
}
VARIANTS = {
    'A': {},
    # A rounder, taller head: more like a helmet.
    'B': {'head_hx': 0.23, 'head_hy': 0.22, 'head_h': 0.40, 'head_r': 0.16, 'head_round': 0.12, 'visor_z': (0.15, 0.27)},
    # A wide, flat head on a slightly smaller body, with bigger boots: more like a little TV.
    'C': {'head_hx': 0.265, 'head_hy': 0.19, 'head_h': 0.31, 'head_r': 0.06, 'head_round': 0.04, 'visor_z': (0.10, 0.22),
          'head_z': 0.70, 'torso_z': (0.24, 0.66), 'torso_hx': 0.16, 'foot_hx': 0.075, 'foot_hy': 0.125},
}

CORNER = 4   # segments per rounded corner (22.5 degrees each: the game draws no edge lines across them)


# ---------------------------------------------------------------------------------------------------------------- helpers

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    return scene


MATERIALS = {}


def material(name):
    if name not in MATERIALS:
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = srgb(TOKENS[MATERIAL_TONES[name]])
        MATERIALS[name] = mat
    return MATERIALS[name]


def rrect(hx, hy, r, corner=CORNER, side_steps=1, dy=0.0):
    """A rounded rectangle in plan, counter-clockwise from the right side: half sizes hx, hy, corner radius r."""
    r = max(0.002, min(r, hx - 0.002, hy - 0.002))
    pts = []
    for cx, cy, a0, (sx, sy, ex, ey) in (
        (hx - r, hy - r, 0, (hx, -hy + r, hx, hy - r)),
        (-hx + r, hy - r, 90, (hx - r, hy, -hx + r, hy)),
        (-hx + r, -hy + r, 180, (-hx, hy - r, -hx, -hy + r)),
        (hx - r, -hy + r, 270, (-hx + r, -hy, hx - r, -hy)),
    ):
        # the straight side leading into this corner, split into side_steps pieces (its start is the last corner's end)
        for k in range(1, side_steps):
            t = k / side_steps
            pts.append((sx + (ex - sx) * t, sy + (ey - sy) * t + dy))
        for i in range(corner + 1):
            a = math.radians(a0 + 90 * i / corner)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a) + dy))
    return pts


def loft(bm, sections, side_steps=1, corner=CORNER):
    """
    A closed solid through rounded rectangles stacked up the Z axis: sections are (z, hx, hy, r) or (z, hx, hy, r, dy), from
    the bottom up. The bottom and top are capped flat. Returns the new verts.
    """
    rings = []
    for s in sections:
        z, hx, hy, r = s[:4]
        dy = s[4] if len(s) > 4 else 0.0
        rings.append([bm.verts.new((x, y, z)) for x, y in rrect(hx, hy, r, corner, side_steps, dy)])
    n = len(rings[0])
    faces = []
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new((a[i], a[j], b[j], b[i])))
    faces.append(bm.faces.new(list(reversed(rings[0]))))
    faces.append(bm.faces.new(rings[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return [v for ring in rings for v in ring]


def rounded_block(hx, hy, h, r_plan, r_edge, z0=0.0, dy=0.0, taper=1.0, bulge=0.0):
    """
    A rounded box from z0 to z0 + h: rounded corners in plan (r_plan) and its top and bottom rims rounded by r_edge, in a few
    steps. `taper` scales the top's plan size against the bottom's (1 is straight); `bulge` swells the sides outward by that
    share at mid height, so the light runs across them instead of filling one flat panel.
    """
    secs = []
    steps = 4
    for k in range(steps + 1):  # the bottom rim, from the underside up
        a = math.radians(90 * (1 - k / steps))
        inset = r_edge * (1 - math.cos(a))
        secs.append((z0 + r_edge * (1 - math.sin(a)) if r_edge else z0, inset))
    for k in range(steps + 1):  # the top rim, up to the top
        a = math.radians(90 * k / steps)
        inset = r_edge * (1 - math.cos(a))
        secs.append((z0 + h - r_edge + r_edge * math.sin(a), inset))
    if not r_edge:
        secs = [(z0, 0.0), (z0 + h, 0.0)]
    if bulge:
        lo, hi = z0 + r_edge, z0 + h - r_edge
        secs += [(lo + (hi - lo) * f, 0.0) for f in (0.25, 0.5, 0.75)]
        secs.sort()
    out = []
    seen = set()
    for z, inset in secs:
        key = round(z, 6)
        if key in seen:
            continue
        seen.add(key)
        t = (z - z0) / h if h else 0
        k = (1 + (taper - 1) * t) * (1 + bulge * math.sin(math.pi * t))
        out.append((z, hx * k - inset, hy * k - inset, max(0.004, r_plan * k - inset), dy))
    bm = bmesh.new()
    loft(bm, out)
    return bm


def chamfer_box(hx, hy, h, c, z0=0.0):
    """A box from z0 to z0 + h with every edge chamfered by c (one 45-degree facet): crisp edge lines in the game."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(2 * hx, 2 * hy, h), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, 0, z0 + h / 2), verts=bm.verts)
    bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=c, segments=1, profile=0.5, affect='EDGES', clamp_overlap=True)
    return bm


def sphere(radius, subdivisions=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    return bm


def band(hx, hy, r, z0, z1, thickness, keep):
    """
    The visor: a solid strip round a rounded-rectangle section (hx, hy, r) from z0 to z1, standing `thickness` proud of it,
    over the stretch of its outline whose points pass `keep(x, y)` (front and sides). Its inner face sits just inside the head.
    """
    inner = rrect(hx - 0.004, hy - 0.004, r - 0.004, side_steps=6)
    outer = rrect(hx + thickness, hy + thickness, r + thickness, side_steps=6)
    n = len(inner)
    kept = [keep(x, y) for x, y in rrect(hx, hy, r, side_steps=6)]
    start = next(i for i in range(n) if kept[i] and not kept[i - 1])
    run = []
    i = start
    while kept[i] and len(run) < n:
        run.append(i)
        i = (i + 1) % n
    bm = bmesh.new()
    loops = []
    for i in run:
        loops.append([
            bm.verts.new((*inner[i], z0)), bm.verts.new((*outer[i], z0)),
            bm.verts.new((*outer[i], z1)), bm.verts.new((*inner[i], z1)),
        ])
    faces = []
    for a, b in zip(loops, loops[1:]):
        for k in range(4):
            m = (k + 1) % 4
            faces.append(bm.faces.new((a[k], b[k], b[m], a[m])))
    faces.append(bm.faces.new(loops[0]))
    faces.append(bm.faces.new(list(reversed(loops[-1]))))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return bm


SMOOTH_ANGLE = 50  # degrees: a rounded part is shaded smooth, except across an edge sharper than this


def to_object(name, bm, parent, location, mat, smooth=True):
    """
    A mesh object from the bmesh, its origin at `location` in its parent's space (so its pivot is the origin). Shaded smooth
    by default (rounded forms read as volume, not as flat panels), with sharp edges kept sharp; the normals go in the file.
    """
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True
        mesh.set_sharp_from_angle(angle=math.radians(SMOOTH_ANGLE))
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    mesh.materials.append(material(mat))
    return obj


def shift(bm, offset):
    bmesh.ops.translate(bm, vec=offset, verts=bm.verts)
    return bm


def merge(dst, src):
    """Add src's geometry to dst (one mesh, one material) and free src."""
    tmp = bpy.data.meshes.new('merge')
    src.to_mesh(tmp)
    src.free()
    dst.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)
    return dst


# --------------------------------------------------------------------------------------------------------------- the agent

def build_agent(p):
    root = bpy.data.objects.new('agent', None)
    bpy.context.scene.collection.objects.link(root)

    # The torso: an ivory block a little wider at the chest than the hips, its rims rounded. Pivot at the hips.
    tz0, tz1 = p['torso_z']
    hip = p['hip_z']
    torso = rounded_block(p['torso_hx'] * 0.9, p['torso_hy'] * 0.92, tz1 - tz0, 0.08, 0.06, z0=tz0 - hip, taper=1.12,
                          bulge=0.05)
    # A chest plate standing a little proud of the front: a second layer, so the front is not one flat panel.
    front = p['torso_hy'] * 0.92 * 1.06 * 1.05
    plate = rounded_block(p['torso_hx'] * 0.6, 0.03, (tz1 - tz0) * 0.5, 0.045, 0.014, z0=tz0 + (tz1 - tz0) * 0.3 - hip)
    merge(torso, shift(plate, (0, front - 0.018, 0)))
    body = to_object('body', torso, root, (0, 0, hip), 'ivory')

    # The battery pack on its back: a chamfered base plate and two upright cells, each with a terminal on top. Obsidian, so
    # the game outlines it: the shape the player watches all climb.
    back = -p['torso_hy'] * 1.05
    plate_y = back - 0.005          # the plate's middle: its front sinks a little into the torso
    cell_y = plate_y - 0.03 - 0.035  # the cells stand on the plate's back face
    pack = chamfer_box(0.13, 0.03, 0.27, 0.012, z0=tz0 + 0.07 - hip)
    shift(pack, (0, plate_y, 0))
    for x in (-0.062, 0.062):
        merge(pack, shift(chamfer_box(0.05, 0.045, 0.23, 0.014, z0=tz0 + 0.08 - hip), (x, cell_y, 0)))
        merge(pack, shift(chamfer_box(0.022, 0.022, 0.03, 0.006, z0=tz0 + 0.31 - hip), (x, cell_y, 0)))
    to_object('pack', pack, body, (0, 0, 0), 'obsidian', smooth=False)

    # The joints: a dark waistband where the legs go in, and a dark ball in each shoulder, so the parts read apart.
    joints = rounded_block(p['torso_hx'] * 0.9 + 0.012, p['torso_hy'] * 0.92 + 0.012, 0.045, 0.08, 0.012,
                           z0=tz0 - 0.012 - hip)
    for sx in (-1, 1):
        merge(joints, shift(sphere(0.046), (p['shoulder_x'] * sx * 0.95, 0, p['shoulder_z'] - hip + 0.005)))
    to_object('joints', joints, body, (0, 0, 0), 'obsidian-dark')

    # The neck: a short dark collar between the torso and the head.
    neck = rounded_block(0.07, 0.065, p['head_z'] - tz1 + 0.04, 0.05, 0.0, z0=tz1 - 0.02 - hip)
    to_object('neck', neck, body, (0, 0, 0), 'obsidian-dark')

    # The head: a rounded, slightly boxy ivory block. Pivot at the neck.
    hx, hy, hh, hr, rr = p['head_hx'], p['head_hy'], p['head_h'], p['head_r'], p['head_round']
    skull = rounded_block(hx, hy, hh, hr, rr, bulge=0.035)
    # A hatch standing a little proud of the back of the head, like the chest plate: the camera looks at this side most.
    hatch = rounded_block(hx * 0.62, 0.03, hh * 0.46, 0.05, 0.014, z0=hh * 0.24)
    merge(skull, shift(hatch, (0, -hy * 1.035 + 0.018, 0)))
    head = to_object('head', skull, body, (0, 0, p['head_z'] - hip), 'ivory')

    # The visor: one wide brass band across the front, wrapping round the front corners to the middle of the sides.
    vz0, vz1 = p['visor_z']
    # The head swells a little at mid height, so the band follows that swell.
    swell = 1 + 0.035 * math.sin(math.pi * (vz0 + vz1) / 2 / hh)
    visor = band(hx * swell, hy * swell, hr * swell, vz0, vz1, 0.022, lambda x, y: y > -0.02)
    to_object('visor', visor, head, (0, 0, 0), 'brass')

    # The antenna: a short ivory stalk off-centre on the top (a dark one vanishes against the background) and a small ball.
    # Pivot at its foot.
    # Its foot sinks 1 cm into the head; the ball's top is at 1.2 m, the top of the box.
    tip_r = 0.035
    foot = hh - 0.01
    tip = 1.2 - tip_r - p['head_z']  # the ball's middle, in the head's space
    stalk = rounded_block(0.015, 0.015, tip - foot - 0.02, 0.01, 0.0)
    antenna = to_object('antenna', stalk, head, (0.09, -0.05, foot), 'ivory')
    to_object('antenna_tip', sphere(tip_r), antenna, (0, 0, tip - foot), 'ivory')
    # A dark collar where it meets the head.
    to_object('antenna_base', rounded_block(0.032, 0.032, 0.03, 0.026, 0.008, z0=-0.012), antenna, (0, 0, 0),
              'obsidian-dark')

    # Arms: stubby ivory mitts hanging from the shoulders, a touch wider at the hand. Pivot at the shoulder.
    for side, sx in (('L', -1), ('R', 1)):
        arm = rounded_block(0.05, 0.055, 0.25, 0.045, 0.045, z0=-0.22, taper=0.82, bulge=0.06)
        to_object(f'arm_{side}', arm, body, (p['shoulder_x'] * sx, 0.0, p['shoulder_z'] - hip), 'ivory')

    # Legs: short dark posts from the hips into chunky ivory boots, the toes a little forward. Pivot at the hip.
    for side, sx in (('L', -1), ('R', 1)):
        leg = rounded_block(p['leg_hx'], p['leg_hx'], hip - 0.06 + 0.03, p['leg_hx'] * 0.75, 0.0, z0=-(hip - 0.06))
        leg_obj = to_object(f'leg_{side}', leg, root, (p['hip_x'] * sx, 0, hip), 'obsidian-dark')
        boot = rounded_block(p['foot_hx'], p['foot_hy'], p['foot_h'], 0.055, 0.04, dy=p['foot_dy'], bulge=0.04)
        to_object(f'foot_{side}', boot, leg_obj, (0, 0, -hip), 'ivory')

    bpy.context.view_layer.update()
    return root


# ------------------------------------------------------------------------------------------------------------- export

def export():
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    options = dict(
        filepath=OUT_GLB,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_apply=False,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_materials='EXPORT',
        export_attributes=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=False,
        export_draco_mesh_compression_enable=False,
        export_image_format='NONE',
    )
    try:
        bpy.ops.export_scene.gltf(export_vertex_color='NONE', **options)
    except TypeError:
        bpy.ops.export_scene.gltf(**options)


def report():
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    tris = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
    size = os.path.getsize(OUT_GLB)
    print(f'AGENT: {len(meshes)} meshes, {tris} triangles, {size} bytes -> {OUT_GLB}')
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in meshes:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
        print(f'  {o.name:12s} parent={o.parent.name:8s} {o.data.materials[0].name:14s} '
              f'tris={sum(len(p.vertices) - 2 for p in o.data.polygons)}')
    print(f'  bounds x {lo.x:.3f}..{hi.x:.3f}  y {lo.y:.3f}..{hi.y:.3f}  z {lo.z:.3f}..{hi.z:.3f}')
    assert hi.x - lo.x <= 0.5601, f'the agent is {hi.x - lo.x:.3f} m wide: it must fit the 0.56 m box seen from behind'
    assert hi.z <= 1.2001 and lo.z >= -0.0001, f'the agent runs from {lo.z:.3f} to {hi.z:.3f} m: it must fit 0 to 1.2'


# ------------------------------------------------------------------------------------------------------------- preview
#
# Stills for the author's approval (CLAUDE.md: generated images need it), close to the game's look: ivory and the obsidian
# parts lit by one sun from the game's direction and a dim ivory ambient, the brass unlit, ivory edge lines on the obsidian
# parts, the floor's tone and the blob shadow under it, on obsidian. Written to tools/ascent/out/ (not in git).

# The agent's light, the same numbers as render.agentLight in src/game/ascent/config.ts. Each is the share of a part's colour it
# gives a face square to it: an ambient on every face, then a key, a fill and a rim that turn with the camera (yaw from the
# camera's side of the agent, positive to the camera's left; pitch up from level), so whichever way the player
# looks, the faces towards the camera, the sides and the outline come out in different tones.
AGENT_LIGHT = {
    'ambient': 0.1,
    'key': (0.9, -60, 35),
    'fill': (0.2, 90, 0),
    'rim': (0.6, 165, 25),
}
GLOW = 0.15  # brass also glows by this share of its colour, so the band stays brass in shade
GAME_CAMERA = {'distance': 6.0, 'look_height': 1.3, 'pitch': 0.32, 'fov': 62}  # src/game/ascent/config.ts


def emission(name, hex_code, strength=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    em = nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = srgb(hex_code)
    em.inputs['Strength'].default_value = strength
    mat.node_tree.links.new(em.outputs[0], out.inputs[0])
    return mat


def diffuse(name, hex_code, glow=0.0):
    """A matte material (the game's Lambert), plus `glow` of its colour as emission."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    d = nodes.new('ShaderNodeBsdfDiffuse')
    d.inputs['Color'].default_value = srgb(hex_code)
    if glow:
        em = nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = srgb(hex_code)
        em.inputs['Strength'].default_value = glow
        add = nodes.new('ShaderNodeAddShader')
        links.new(d.outputs[0], add.inputs[0])
        links.new(em.outputs[0], add.inputs[1])
        links.new(add.outputs[0], out.inputs[0])
    else:
        links.new(d.outputs[0], out.inputs[0])
    return mat


EDGE_ANGLE = 30  # degrees: the game draws an edge whose faces meet more sharply than this (agent.ts, as render.ts)


def lines_for(obj, mat, width=0.004):
    """A thin bar on each edge the game draws (EdgesGeometry at EDGE_ANGLE), standing in for its 1px ivory lines."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    out = bmesh.new()
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) < math.radians(EDGE_ANGLE):
            continue
        a, b = e.verts[0].co, e.verts[1].co
        d = b - a
        m = Matrix.Translation((a + b) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.create_cube(out, size=1.0, matrix=m @ Matrix.Diagonal((width, width, d.length + width, 1)))
    bm.free()
    mesh = bpy.data.meshes.new(obj.name + '_lines')
    out.to_mesh(mesh)
    out.free()
    lines = bpy.data.objects.new(obj.name + '_lines', mesh)
    bpy.context.scene.collection.objects.link(lines)
    lines.parent = obj
    mesh.materials.append(mat)
    return lines


def stage(silhouette=False):
    """Swap the materials for the preview's, add the lines, the light, the floor and the blob shadow, and set the renderer."""
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type == 'MESH']
    if silhouette:
        flat = emission('silhouette', TOKENS['ivory'])
        for o in meshes:
            o.data.materials[0] = flat
    else:
        line_mat = emission('lines', TOKENS['ivory'], 0.55)  # the game's edge opacity over a dark part
        lit = {name: diffuse(f'lit_{name}', TOKENS[MATERIAL_TONES[name]]) for name in ('ivory', 'obsidian', 'obsidian-dark')}
        lit['brass'] = diffuse('lit_brass', TOKENS['brass'], GLOW)
        for o in meshes:
            name = o.data.materials[0].name
            if name in OUTLINED:
                lines_for(o, line_mat)
            o.data.materials[0] = lit[name]

    for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('preview')
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    # The ambient: a uniform ivory world (a world of strength S lights every face to S of its colour). The background itself
    # is drawn by the floor and a wall of --bg behind everything, so the ambient does not show as the sky.
    ivory = srgb(TOKENS['ivory'])
    bg.inputs[0].default_value = (ivory[0], ivory[1], ivory[2], 1.0)
    bg.inputs[1].default_value = 0.0 if silhouette else AGENT_LIGHT['ambient']
    if not silhouette:
        for name in ('key', 'fill', 'rim'):
            data = bpy.data.lights.new(name, 'SUN')
            data.energy = AGENT_LIGHT[name][0] * math.pi  # a sun of strength S lights a square-on face to S / pi of it
            data.color = ivory[:3]
            data.angle = 0.0
            data.use_shadow = False  # the game has no shadow maps: the blob under the agent is its one shadow
            scene.collection.objects.link(bpy.data.objects.new(name, data))

    # The floor (unlit, in the tone the game gives a floor's top) and the blob shadow under the agent.
    floor = bmesh.new()
    bmesh.ops.create_grid(floor, x_segments=1, y_segments=1, size=400)
    obj = bpy.data.objects.new('floor', bpy.data.meshes.new('floor'))
    floor.to_mesh(obj.data)
    floor.free()
    obj.data.materials.append(emission('floor', TOKENS['face2']))
    scene.collection.objects.link(obj)
    disc = bmesh.new()
    bmesh.ops.create_circle(disc, cap_ends=True, segments=28, radius=0.42 * 0.75 + 0.25 * 0.42)
    obj = bpy.data.objects.new('shadow', bpy.data.meshes.new('shadow'))
    disc.to_mesh(obj.data)
    disc.free()
    obj.location.z = 0.002
    obj.data.materials.append(emission('shadow', TOKENS['void']))
    scene.collection.objects.link(obj)
    # Far away, a wall of --bg, so the view reads as the game's background beyond the floor.
    wall = bmesh.new()
    bmesh.ops.create_grid(wall, x_segments=1, y_segments=1, size=1000)
    obj = bpy.data.objects.new('backdrop', bpy.data.meshes.new('backdrop'))
    wall.to_mesh(obj.data)
    wall.free()
    obj.data.materials.append(emission('backdrop', TOKENS['bg']))
    scene.collection.objects.link(obj)
    for o in list(scene.objects):
        if o.name == 'floor' and silhouette:
            o.data.materials[0] = emission('floor_bg', TOKENS['bg'])
        if o.name == 'shadow' and silhouette:
            o.hide_render = True
    return scene


def camera(scene):
    if scene.camera:
        return scene.camera
    data = bpy.data.cameras.new('cam')
    data.clip_end = 1000
    cam = bpy.data.objects.new('cam', data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


def shoot(scene, path, pos, target, fov=None, lens=None, size=(1280, 720)):
    cam = camera(scene)
    cam.data.sensor_fit = 'VERTICAL'
    if fov is not None:
        cam.data.lens_unit = 'FOV'
        cam.data.angle_y = math.radians(fov)
    else:
        cam.data.lens_unit = 'MILLIMETERS'
        cam.data.lens = lens
    # Backdrop behind the target, square to the view, far off.
    d = (Vector(target) - Vector(pos)).normalized()
    backdrop = scene.objects['backdrop']
    backdrop.location = Vector(pos) + d * 420
    backdrop.rotation_euler = (-d).to_track_quat('Z', 'Y').to_euler()
    cam.location = pos
    cam.rotation_euler = (Vector(target) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    # The lights turn with the camera: yaw about the vertical from the camera's side, then up by the pitch.
    back = Vector((pos[0] - target[0], pos[1] - target[1], 0)).normalized()
    for name in ('key', 'fill', 'rim'):
        light = scene.objects.get(name)
        if light is None:
            continue
        _, yaw, pitch = AGENT_LIGHT[name]
        a = math.radians(yaw)  # positive yaw turns towards the camera's left
        side = Vector((back.x * math.cos(a) + back.y * math.sin(a), -back.x * math.sin(a) + back.y * math.cos(a), 0))
        to_light = side * math.cos(math.radians(pitch)) + Vector((0, 0, math.sin(math.radians(pitch))))
        light.rotation_euler = to_light.to_track_quat('Z', 'Y').to_euler()
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f'PREVIEW -> {path}')
    return path


def game_camera(fov_scale=1.0):
    """The game's camera at the start of a climb: behind the agent (the agent faces +Y), at its height and distance."""
    c = GAME_CAMERA
    back = c['distance'] * math.cos(c['pitch'])
    up = c['look_height'] + c['distance'] * math.sin(c['pitch'])
    fov = math.degrees(2 * math.atan(math.tan(math.radians(c['fov'] / 2)) * fov_scale))
    return (0.0, -back, up), (0.0, 0.0, c['look_height']), fov


def sheet(paths, out_path, columns):
    """Stills side by side (rows of `columns`), one PNG."""
    import numpy as np

    tiles = []
    for p in paths:
        img = bpy.data.images.load(p)
        w, h = img.size
        tiles.append(np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4))
        bpy.data.images.remove(img)
    rows = [np.concatenate(tiles[i:i + columns], axis=1) for i in range(0, len(tiles), columns)]
    grid = np.concatenate(list(reversed(rows)), axis=0)  # Blender's pixels start at the bottom row
    out = bpy.data.images.new('sheet', grid.shape[1], grid.shape[0], alpha=False)
    out.pixels = grid.ravel().tolist()
    out.filepath_raw = out_path
    out.file_format = 'PNG'
    out.save()
    print(f'PREVIEW -> {out_path}')


FRONT_3Q = ((1.55, 2.25, 1.15), (0.0, 0.0, 0.6))
SIDE = ((3.2, 0.0, 0.75), (0.0, 0.0, 0.6))
BEHIND_CLOSE = ((0.0, -2.6, 1.55), (0.0, 0.0, 0.62))


def preview():
    os.makedirs(OUT_DIR, exist_ok=True)
    out = lambda name: os.path.join(OUT_DIR, name)
    tmp = os.path.join(OUT_DIR, 'tiles')
    os.makedirs(tmp, exist_ok=True)

    # The approved design (A): the game's view from behind, the same view cropped close, the front three-quarter.
    scene = stage()
    bpy.ops.wm.save_as_mainfile(filepath=out('agent.blend'))
    pos, target, fov = game_camera()
    shoot(scene, out('agent-behind-game.png'), pos, target, fov=fov)
    pos, target, fov = game_camera(0.28)
    shoot(scene, out('agent-behind-game-crop.png'), pos, (0.0, 0.0, 0.85), fov=fov, size=(900, 900))
    shoot(scene, out('agent-front.png'), *FRONT_3Q, lens=55, size=(900, 900))
    variant_tiles = {
        'A': [shoot(scene, os.path.join(tmp, 'A_front.png'), *FRONT_3Q, lens=55, size=(600, 600)),
              shoot(scene, os.path.join(tmp, 'A_back.png'), *BEHIND_CLOSE, lens=50, size=(600, 600))],
    }

    # The silhouette: from behind, the side and the front three-quarter.
    reset_scene()
    MATERIALS.clear()
    build_agent(BASE)
    scene = stage(silhouette=True)
    sil = [shoot(scene, os.path.join(tmp, f'sil_{i}.png'), *view, lens=50, size=(600, 700))
           for i, view in enumerate((BEHIND_CLOSE, SIDE, FRONT_3Q))]
    sheet(sil, out('agent-silhouette.png'), 3)

    # Two variations for the author to choose between: B (a rounder, taller head) and C (a wide, flat head, bigger boots).
    if '--variants' not in ARGS:
        return
    for key in ('B', 'C'):
        reset_scene()
        MATERIALS.clear()
        build_agent({**BASE, **VARIANTS[key]})
        scene = stage()
        variant_tiles[key] = [shoot(scene, os.path.join(tmp, f'{key}_front.png'), *FRONT_3Q, lens=55, size=(600, 600)),
                              shoot(scene, os.path.join(tmp, f'{key}_back.png'), *BEHIND_CLOSE, lens=50, size=(600, 600))]
    sheet([variant_tiles[k][0] for k in 'ABC'] + [variant_tiles[k][1] for k in 'ABC'], out('agent-variants.png'), 3)


def main():
    reset_scene()
    build_agent(BASE)
    export()
    report()
    if '--preview' in ARGS:
        preview()


main()
