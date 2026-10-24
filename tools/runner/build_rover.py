# The runner's rover, built procedurally and exported as src/game/runner/assets/rover.glb (docs/RUNNER.md, "The rover").
#
#   blender -b --factory-startup -P tools/runner/build_rover.py              # the .glb only
#   blender -b --factory-startup -P tools/runner/build_rover.py -- --preview # and docs/runner-concepts/rover-preview.png
#
# Everything is made from numbers in this file, so the same Blender version gives the same file. No textures and no UVs:
# colour is a per-vertex attribute (the tokens below, darkened in crevices by a small ambient-occlusion pass), and there
# are no normals in the file either: three.js shades a glTF mesh without normals flat, which is the look we want, and the
# file is about a third smaller. Blender works Z up with the rover facing +Y; the glTF exporter turns that into +Y up and
# -Z forward. Sizes are metres: about 1.7 m wide and 2.6 m long; the game scales it to its lane width (rover.ts).
#
# Node names are the contract with rover.ts: rover (root, on the ground), rover_body, antenna (pivot at its foot),
# beacon, rocker_L/R (pivot at the body joint), bogie_L/R (pivot at the rocker joint), wheel_FL/ML/RL/FR/MR/RR (origin at
# the axle, so a rotation about local X spins it). Wheels hang from the rockers and bogies, as on a rocker-bogie rover.

import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT_GLB = os.path.join(ROOT, 'src', 'game', 'runner', 'assets', 'rover.glb')
OUT_PREVIEW = os.path.join(ROOT, 'docs', 'runner-concepts', 'rover-preview.png')
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def srgb(hex_code):
    """A token's sRGB hex as a linear RGBA tuple (glTF vertex colours are linear)."""
    h = hex_code.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


# Colours, from src/styles/design-system/tokens.css (the same values as RUNNER_COLORS in config.ts).
IVORY = srgb('#ece6d8')      # --text: the shell, hub caps and joint caps
DARK = srgb('#151518')       # --surface-2: tyres and the underbody
METAL = srgb('#1b1b1f')      # --surface-3: rockers, bogies, the antenna mast
SLIT = srgb('#09090a')       # --bg (obsidian): the sensor slits, recessed into the shell
BRASS = srgb('#c9a96a')      # --brass: the beacon, the one accent
BRASS_LIGHT = srgb('#f1dca8')  # --brass-highlight: the beacon's glow

# Proportions (metres, Blender axes: x right, y forward, z up).
WHEEL_R = 0.33
WHEEL_W = 0.28
WHEEL_X = 0.70
WHEEL_Y = (0.95, 0.0, -0.95)
ARM_X = 0.515
WEDGE = 0.035  # metres of drop per metre forward, upper hull only
SEGMENTS = 12

COLOR_ATTR = 'Color'


# ---------------------------------------------------------------------------------------------------------------- helpers

def new_bm():
    bm = bmesh.new()
    bm.verts.layers.float_color.new(COLOR_ATTR)
    return bm


def paint(bm, verts, color):
    layer = bm.verts.layers.float_color[COLOR_ATTR]
    for v in verts:
        v[layer] = color


def octagon(z, hx, yf, yb, ch):
    """A plan-view octagon at height z: a rectangle (half width hx, front yf, back yb) with its corners cut by ch."""
    return [
        (hx - ch, yf, z), (hx, yf - ch, z), (hx, yb + ch, z), (hx - ch, yb, z),
        (-hx + ch, yb, z), (-hx, yb + ch, z), (-hx, yf - ch, z), (-hx + ch, yf, z),
    ]


def hull(bm, points, color):
    """The convex hull of the points, coplanar triangles merged into flat facets. Returns its faces."""
    verts = [bm.verts.new(p) for p in points]
    res = bmesh.ops.convex_hull(bm, input=verts, use_existing_faces=False)
    junk = [g for g in res['geom_interior'] + res['geom_unused'] if isinstance(g, bmesh.types.BMVert)]
    if junk:
        bmesh.ops.delete(bm, geom=junk, context='VERTS')
    faces = [g for g in res['geom'] if isinstance(g, bmesh.types.BMFace) and g.is_valid]
    edges = list({e for f in faces for e in f.edges})
    fverts = list({v for f in faces for v in f.verts})
    res2 = bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.5), verts=fverts, edges=edges)
    faces = [f for f in res2['region'] if isinstance(f, bmesh.types.BMFace) and f.is_valid]
    paint(bm, {v for f in faces for v in f.verts}, color)
    return faces


def facing(faces, direction, min_dot=0.9995, where=lambda c: True):
    """The faces whose normal points along `direction` (and whose centre passes `where`)."""
    d = Vector(direction).normalized()
    out = []
    for f in faces:
        if not f.is_valid:
            continue
        f.normal_update()
        if f.normal.dot(d) >= min_dot and where(f.calc_center_median()):
            out.append(f)
    return out


def recess(bm, faces, color, thickness, depth):
    """
    Inset each face by `thickness` (the border stays shell colour), then sink what is left by `depth` behind a thin wall:
    a slit with a crisp edge. The sunk face takes `color`; the wall shades between the two.
    """
    if not faces:
        return
    bm.normal_update()
    bmesh.ops.inset_individual(bm, faces=faces, thickness=thickness, depth=0.0, use_even_offset=True)
    bmesh.ops.inset_individual(bm, faces=faces, thickness=0.006, depth=-depth, use_even_offset=True)
    paint(bm, {v for f in faces for v in f.verts}, color)


def lathe(bm, profile, axis_sign, color, segments=SEGMENTS, cap_start=False, cap_end=False, offset=0.5):
    """
    A solid of revolution about the X axis. `profile` is a list of (x, r) from one end to the other; axis_sign = -1 mirrors
    x (the left side). Returns (verts per ring, faces per band) so callers can pick bands.
    """
    rings = []
    for x, r in profile:
        ring = []
        for i in range(segments):
            a = 2 * math.pi * (i + offset) / segments
            ring.append(bm.verts.new((x * axis_sign, r * math.cos(a), r * math.sin(a))) if r > 1e-6 else None)
        if r <= 1e-6:
            ring = [bm.verts.new((x * axis_sign, 0, 0))]
        rings.append(ring)
    bands = []
    for a, b in zip(rings, rings[1:]):
        band = []
        for i in range(segments):
            j = (i + 1) % segments
            if len(a) == 1:
                quad = (a[0], b[i], b[j])
            elif len(b) == 1:
                quad = (a[i], b[0], a[j])
            else:
                quad = (a[i], b[i], b[j], a[j])
            band.append(bm.faces.new(tuple(reversed(quad)) if axis_sign > 0 else quad))  # outward
        bands.append(band)
    if cap_start and len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])) if axis_sign > 0 else rings[0])
    if cap_end and len(rings[-1]) > 1:
        bm.faces.new(rings[-1] if axis_sign > 0 else list(reversed(rings[-1])))
    paint(bm, [v for ring in rings for v in ring], color)
    return rings, bands


def beam(bm, p0, p1, half_w, half_h, chamfer, color, extend=0.0):
    """A chamfered bar from p0 to p1 (both in the YZ plane at one x), octagonal in section, ends capped."""
    p0, p1 = Vector(p0), Vector(p1)
    axis = (p1 - p0).normalized()
    p0, p1 = p0 - axis * extend, p1 + axis * extend
    side = Vector((1, 0, 0))
    up = axis.cross(side).normalized()
    c = chamfer
    section = [(half_w - c, half_h), (half_w, half_h - c), (half_w, -half_h + c), (half_w - c, -half_h),
               (-half_w + c, -half_h), (-half_w, -half_h + c), (-half_w, half_h - c), (-half_w + c, half_h)]
    ends = []
    for p in (p0, p1):
        ends.append([bm.verts.new(p + side * s + up * u) for s, u in section])
    a, b = ends
    faces = [bm.faces.new((a[i], a[(i + 1) % 8], b[(i + 1) % 8], b[i])) for i in range(8)]
    faces.append(bm.faces.new(list(reversed(a))))
    faces.append(bm.faces.new(b))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    paint(bm, a + b, color)


def translate(verts, offset):
    for v in verts:
        v.co += Vector(offset)


def to_object(name, bm, parent=None, location=(0, 0, 0), material=None):
    """A mesh object from the bmesh, its origin at `location` in its parent's space (so the pivot is the origin)."""
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = False
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    obj.location = location
    if material is not None:
        mesh.materials.append(material)
    return obj


# ----------------------------------------------------------------------------------------------------------------- parts

def build_body(bm):
    """Underbody (dark), lower chassis (ivory), faceted upper hull (ivory) with recessed sensor slits."""
    # The underbody: a dark tray between the wheels.
    hull(bm, octagon(0.40, 0.40, 0.92, -0.92, 0.08) + octagon(0.53, 0.42, 0.98, -0.98, 0.09), DARK)

    # The lower chassis: an ivory skirt sloping in towards the bottom, so it sits in the hull's shadow.
    hull(bm, octagon(0.50, 0.36, 0.98, -0.96, 0.10) + octagon(0.76, 0.50, 1.14, -1.06, 0.14), IVORY)

    # The upper hull: five rings from the tucked-in base to the flat deck. Convex in every direction, so the hull of the
    # points is exactly the shell; the corner cuts make the facets.
    rings = [
        octagon(0.77, 0.60, 1.18, -1.08, 0.16),   # base, tucked in over the chassis
        octagon(0.88, 0.67, 1.30, -1.18, 0.22),   # belt: the widest line, a fender over the wheels
        octagon(1.00, 0.62, 1.14, -1.08, 0.22),   # shoulder: top of the nose and the tail
        octagon(1.12, 0.52, 0.78, -0.86, 0.15),   # brow: where the visor band starts
        octagon(1.17, 0.45, 0.56, -0.70, 0.10),   # deck
    ]
    # A slight wedge: the whole shell sheared so the nose sits lower than the tail (a shear keeps it convex).
    shell = hull(bm, [(x, y, z - WEDGE * y) for r in rings for (x, y, z) in r], IVORY)

    # Sensor slits: the visor band at the front of the deck, a long slit on each side of it, a tail slit.
    visor = facing(shell, (0, 0.05 / math.hypot(0.22, 0.05) + WEDGE, 0.22 / math.hypot(0.22, 0.05)), 0.998,
                   lambda c: c.y > 0.4)
    sides = [f for sx in (1, -1) for f in facing(shell, (0.05 * sx, 0, 0.07), 0.99, lambda c: c.z > 1.1)]
    belts = [f for sx in (1, -1) for f in facing(shell, (0.12 * sx, 0, 0.05), 0.99, lambda c: 0.88 < c.z < 1.0)]
    tail = facing(shell, (0, -0.12 / 0.22 + WEDGE, 1), 0.998, lambda c: c.y < -0.5)
    recess(bm, visor, SLIT, 0.035, 0.012)
    recess(bm, sides, SLIT, 0.03, 0.01)
    recess(bm, belts, SLIT, 0.05, 0.01)
    recess(bm, tail, SLIT, 0.075, 0.012)

    # A deck hatch: a shallow recessed panel, ivory (a shadow line, not a colour).
    deck = facing(shell, (0, WEDGE, 1), 0.9999, lambda c: c.z > 1.13)
    if deck:
        bmesh.ops.inset_individual(bm, faces=deck, thickness=0.11, depth=0.0, use_even_offset=True)
        bmesh.ops.inset_individual(bm, faces=deck, thickness=0.012, depth=-0.008, use_even_offset=True)
    return shell


def build_wheel(sign):
    """One wheel about its axle (origin): tyre with chunky tread blocks, a recessed ivory hub cap. Outer face at +x*sign."""
    bm = new_bm()
    h = WHEEL_W / 2
    r = WHEEL_R
    side = r - 0.06  # sidewall radius
    profile = [
        (-h, 0.0),
        (-h, side),
        (-h + 0.045, r - 0.025),
        (h - 0.045, r - 0.025),
        (h, side),
        (h, 0.15),
        (h - 0.05, 0.15),
    ]
    _, bands = lathe(bm, profile, sign, DARK)
    tread = bands[2]
    bm.normal_update()  # new faces have no normal until asked; inset needs them
    # Each tread facet becomes a raised block with a groove round it .
    bmesh.ops.inset_individual(bm, faces=tread, thickness=0.026, depth=0.03, use_even_offset=True)
    # The hub cap, ivory, sunk into the tyre's face, with a low faceted dome and a dark centre pin.
    lathe(bm, [(h - 0.05, 0.145), (h - 0.03, 0.13), (h - 0.018, 0.07), (h - 0.014, 0.04)], sign, IVORY,
          cap_start=False)
    lathe(bm, [(h - 0.014, 0.04), (h - 0.006, 0.03), (h - 0.004, 0.0)], sign, METAL, segments=8, offset=0.0)
    # Close the hub's back so the cap reads as a solid disc from any angle.
    lathe(bm, [(h - 0.05, 0.0), (h - 0.05, 0.145)], sign, IVORY)
    return bm


def build_antenna():
    """The mast (dark): a collar on the deck and a thin stalk. Origin at its foot."""
    bm = new_bm()
    # lathe() turns about X; build along X then turn the verts upright.
    lathe(bm, [(0, 0), (0, 0.055), (0.035, 0.05), (0.045, 0.024)], 1, METAL, segments=10, offset=0.0)
    lathe(bm, [(0.045, 0.016), (0.31, 0.012), (0.325, 0.0)], 1, METAL, segments=8, offset=0.0)
    bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.radians(-90), 4, 'Y'), verts=bm.verts[:])  # +X to +Z
    return bm


def build_beacon():
    bm = new_bm()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.085)
    paint(bm, bm.verts[:], BRASS)
    return bm


def arm_mesh(segments_list, joints, sign):
    """Beams (pairs of points, in the arm's own space) and joint pins, for one side."""
    bm = new_bm()
    for p0, p1 in segments_list:
        beam(bm, (0, *p0), (0, *p1), 0.026, 0.045, 0.014, METAL, extend=0.03)
    for (y, z), cap in joints:
        before = set(bm.verts)
        lathe(bm, [(-0.04, 0), (-0.04, 0.052), (0.04, 0.052), (0.046, 0.04)], sign, METAL, segments=10, offset=0.0)
        if cap:
            lathe(bm, [(0.046, 0.032), (0.054, 0.024), (0.056, 0)], sign, IVORY, segments=10, offset=0.0,
                  cap_start=True)
        translate([v for v in bm.verts if v not in before], (0, y, z))
    return bm


# --------------------------------------------------------------------------------------------------------------- assembly

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    return scene


def make_materials():
    paint_mat = bpy.data.materials.new('rover_paint')
    paint_mat.use_nodes = True
    nodes = paint_mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    attr = nodes.new('ShaderNodeVertexColor')
    attr.layer_name = COLOR_ATTR
    paint_mat.node_tree.links.new(attr.outputs[0], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.55
    bsdf.inputs['Metallic'].default_value = 0.0

    beacon_mat = bpy.data.materials.new('rover_beacon')
    beacon_mat.use_nodes = True
    bsdf = next(n for n in beacon_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = BRASS
    bsdf.inputs['Emission Color'].default_value = BRASS_LIGHT
    bsdf.inputs['Emission Strength'].default_value = 1.0
    bsdf.inputs['Roughness'].default_value = 0.4
    return paint_mat, beacon_mat


# Suspension geometry (y, z), right side; the left side mirrors x.
ROCKER_PIVOT = (0.20, 0.64)
BOGIE_PIVOT = (-0.475, 0.54)
AXLE_Z = WHEEL_R


def build_rover():
    paint_mat, beacon_mat = make_materials()
    root = bpy.data.objects.new('rover', None)
    bpy.context.scene.collection.objects.link(root)

    bm = new_bm()
    build_body(bm)
    body = to_object('rover_body', bm, root, (0, 0, 0), paint_mat)

    antenna = to_object('antenna', build_antenna(), body, (0, -0.30, 1.17 + WEDGE * 0.30), paint_mat)
    to_object('beacon', build_beacon(), antenna, (0, 0, 0.325 + 0.07), beacon_mat)

    ry, rz = ROCKER_PIVOT
    by, bz = BOGIE_PIVOT
    for side, sign in (('R', 1), ('L', -1)):
        # Rocker: from its body pivot, one leg down to the front axle, one back to the bogie pivot (arm space = pivot at 0).
        front = (WHEEL_Y[0] - ry, AXLE_Z - rz)
        back = (by - ry, bz - rz)
        rocker_bm = arm_mesh([((0, 0), front), ((0, 0), back)], [((0, 0), True), (front, False), (back, False)], sign)
        rocker = to_object(f'rocker_{side}', rocker_bm, root, (ARM_X * sign, ry, rz), paint_mat)
        # Bogie: an inverted V from its pivot to the middle and rear axles.
        mid = (WHEEL_Y[1] - by, AXLE_Z - bz)
        rear = (WHEEL_Y[2] - by, AXLE_Z - bz)
        bogie_bm = arm_mesh([((0, 0), mid), ((0, 0), rear)], [((0, 0), True), (mid, False), (rear, False)], sign)
        bogie = to_object(f'bogie_{side}', bogie_bm, rocker, (0, by - ry, bz - rz), paint_mat)
        # Wheels: origin on the axle, offset outward from the arm.
        dx = (WHEEL_X - ARM_X) * sign
        to_object(f'wheel_F{side}', build_wheel(sign), rocker, (dx, front[0], front[1]), paint_mat)
        to_object(f'wheel_M{side}', build_wheel(sign), bogie, (dx, mid[0], mid[1]), paint_mat)
        to_object(f'wheel_R{side}', build_wheel(sign), bogie, (dx, rear[0], rear[1]), paint_mat)
        # Axle stubs from the arm to the wheel, part of the arm (they do not spin visibly).
    bpy.context.view_layer.update()
    return root


# ------------------------------------------------------------------------------------------------- ambient occlusion

AO_RAYS = 48
AO_DISTANCE = 0.45
AO_STRENGTH = 0.55   # the darkest a fully enclosed vertex gets: colour × (1 - AO_STRENGTH)
GROUND_DARKEN = 0.18  # extra darkening near the ground, fading out by GROUND_FADE metres
GROUND_FADE = 0.6


def bake_ao(objects):
    """
    Darken each vertex's colour by how much of its hemisphere the rover (and the ground) hides within AO_DISTANCE: a
    cheap ambient occlusion, baked once into the colours. Rays are seeded, so the result repeats.
    """
    world = []
    offset = 0
    polys = []
    for obj in objects:
        mw = obj.matrix_world
        for v in obj.data.vertices:
            world.append(mw @ v.co)
        for p in obj.data.polygons:
            polys.append([offset + i for i in p.vertices])
        offset += len(obj.data.vertices)
    # The ground, as one big quad, so the underside and the tyres' feet get darker.
    g = len(world)
    world += [Vector((-5, -5, 0)), Vector((5, -5, 0)), Vector((5, 5, 0)), Vector((-5, 5, 0))]
    polys.append([g, g + 1, g + 2, g + 3])
    tree = BVHTree.FromPolygons(world, polys)

    rng = random.Random(7)
    dirs = []
    while len(dirs) < AO_RAYS:
        d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        if 0.05 < d.length <= 1:
            dirs.append(d.normalized())

    for obj in objects:
        mesh = obj.data
        mw = obj.matrix_world
        nm = mw.to_3x3().inverted().transposed()
        attr = mesh.color_attributes[COLOR_ATTR]
        for v in mesh.vertices:
            p = mw @ v.co
            n = (nm @ v.normal).normalized()
            hidden = 0
            total = 0
            for d in dirs:
                if d.dot(n) < 0:
                    d = -d
                weight = d.dot(n)
                total += weight
                hit = tree.ray_cast(p + n * 0.004, d, AO_DISTANCE)
                if hit[0] is not None:
                    hidden += weight * (1 - hit[3] / AO_DISTANCE) ** 0.5
            occl = hidden / total if total else 0
            ground = GROUND_DARKEN * max(0.0, 1 - p.z / GROUND_FADE)
            k = max(0.0, 1 - AO_STRENGTH * occl - ground)
            c = attr.data[v.index].color
            attr.data[v.index].color = (c[0] * k, c[1] * k, c[2] * k, 1.0)


# ------------------------------------------------------------------------------------------------------------- export

def export(root):
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_apply=False,
        export_texcoords=False,
        export_normals=False,
        export_tangents=False,
        export_materials='EXPORT',
        export_vertex_color='NAME',
        export_vertex_color_name=COLOR_ATTR,
        export_attributes=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=False,
        export_draco_mesh_compression_enable=False,
        export_image_format='NONE',
    )


def stats(objects):
    tris = 0
    for obj in objects:
        for p in obj.data.polygons:
            tris += len(p.vertices) - 2
    return tris


# ------------------------------------------------------------------------------------------------------------- preview

def preview(root, meshes):
    """Three views (front three-quarter, side, the chase camera's view from behind) side by side, on obsidian."""
    import numpy as np

    scene = bpy.context.scene
    for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'BLENDER_WORKBENCH'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x = 900
    scene.render.resolution_y = 640
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('preview')
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = srgb('#09090a')
    bg.inputs[1].default_value = 1.0
    if scene.render.engine == 'BLENDER_WORKBENCH':
        shading = scene.display.shading
        shading.light = 'STUDIO'
        shading.color_type = 'VERTEX'
        shading.show_cavity = True
        shading.show_shadows = True
        shading.background_type = 'WORLD'
    else:
        # A soft key, a rim from behind and a fill: roughly the game's ivory light.
        for name, rot, energy, size in (('key', (55, 0, 40), 3.2, 4.0), ('rim', (60, 0, 200), 2.0, 2.0),
                                        ('fill', (75, 0, -70), 0.8, 6.0)):
            light = bpy.data.lights.new(name, 'SUN')
            light.energy = energy
            light.angle = math.radians(size)
            obj = bpy.data.objects.new(name, light)
            obj.rotation_euler = [math.radians(a) for a in rot]
            scene.collection.objects.link(obj)
        bg.inputs[1].default_value = 0.0
        # Ambient: a dim ivory world from below the horizon would look odd; use a faint uniform world instead.
        bg.inputs[0].default_value = srgb('#2a2824')
        bg.inputs[1].default_value = 0.35
        # Ground: obsidian, so the shadow sits on something.
        mesh = bpy.data.meshes.new('ground')
        bmg = bmesh.new()
        bmesh.ops.create_grid(bmg, x_segments=1, y_segments=1, size=200)
        bmg.to_mesh(mesh)
        bmg.free()
        gmat = bpy.data.materials.new('ground')
        gmat.use_nodes = True
        gb = next(n for n in gmat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        gb.inputs['Base Color'].default_value = srgb('#0f0f11')
        gb.inputs['Roughness'].default_value = 0.9
        mesh.materials.append(gmat)
        ground = bpy.data.objects.new('ground', mesh)
        scene.collection.objects.link(ground)

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 60
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    target = Vector((0, 0, 0.7))
    views = [Vector((3.6, 4.4, 2.2)), Vector((5.6, 0.0, 0.9)), Vector((1.4, -5.6, 2.9))]
    tiles = []
    for i, pos in enumerate(views):
        cam.location = pos
        cam.rotation_euler = (target - pos).to_track_quat('-Z', 'Y').to_euler()
        path = os.path.join(bpy.app.tempdir, f'rover_view_{i}.png')
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(path)
        w, hgt = img.size
        px = np.array(img.pixels[:], dtype=np.float32).reshape(hgt, w, 4)
        tiles.append(px)
        bpy.data.images.remove(img)
    sheet = np.concatenate(tiles, axis=1)
    out = bpy.data.images.new('rover_preview', sheet.shape[1], sheet.shape[0], alpha=False)
    out.pixels = sheet.ravel().tolist()
    out.filepath_raw = OUT_PREVIEW
    out.file_format = 'PNG'
    out.save()


def main():
    reset_scene()
    root = build_rover()
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in meshes:
        o.data.color_attributes.active_color = o.data.color_attributes[COLOR_ATTR]
    bake_ao(meshes)
    tris = stats(meshes)
    export(root)
    size = os.path.getsize(OUT_GLB)
    print(f'ROVER: {len(meshes)} meshes, {tris} triangles, {size} bytes -> {OUT_GLB}')
    for o in meshes:
        print(f'  {o.name:12s} parent={o.parent.name if o.parent else "-":12s} loc={tuple(round(c, 3) for c in o.location)}'
              f' tris={sum(len(p.vertices) - 2 for p in o.data.polygons)}')
    if '--preview' in ARGS:
        preview(root, meshes)
        print(f'PREVIEW -> {OUT_PREVIEW}')


main()
