# R7: Ascent's test climb, built from scratch and exported as src/game/ascent/assets/test-climb.glb (docs/ASCENT.md, "Art
# pipeline: Blender to Three.js"). Phase 2 proves the pipeline with it: a short climb up a giant workshop desk (books, a stool,
# a chair turned round, the desk, a keyboard, a mug, upright books, the monitor, a desk lamp), then the brass ring above.
#
#   blender -b --factory-startup -P tools/ascent/build_test_climb.py              # the .glb only
#   blender -b --factory-startup -P tools/ascent/build_test_climb.py -- --preview # and tools/ascent/out/ (renders, .blend)
#
# Everything is made from numbers in this file, so the same Blender version gives the same file. Blender is the level
# editor; the contract with the game (src/game/ascent/level.ts, gltf-level.ts) is in the names and custom properties:
#
#   COL_<name>      a box mesh, invisible in the game: what the agent stands on and bumps into. Axis-aligned, never rotated.
#     route = n     custom property: the n-th block of the climb (1, 2, ...), in order; the fairness test walks them
#     ground = 1    custom property: the floor
#   SPAWN           an empty: where the agent's feet start; it faces the empty's +Y (the glTF exporter's -Z, yaw 0)
#   GOAL            the brass ring; the game spins it about the vertical through its origin
#   anything else   scenery, drawn by the game in the token colours of its material: obsidian, obsidian-dark, brass, ivory
#
# No textures, UVs or normals in the file: the game shades each face by the way it points and draws the edge lines itself.
# Blender works Z up; the glTF exporter turns that into +Y up, and Blender's +Y (forward) into -Z. Sizes are metres, at the
# agent's scale (it is 1.2 m tall), so the desk is a giant's.

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT_GLB = os.path.join(ROOT, 'src', 'game', 'ascent', 'assets', 'test-climb.glb')
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


# Material names are the contract (the game swaps each for its token colours: src/game/ascent/gltf-level.ts). These hex
# values are only for the .blend and the preview renders, copied from src/styles/design-system/tokens.css; the game reads the
# tokens themselves.
PREVIEW_TONES = {
    # name: (top, sides along x, sides along y, bottom)
    'obsidian': ('#1b1b1f', '#151518', '#0f0f11', '#020203'),       # --surface-3, -2, -1, --void
    'obsidian-dark': ('#151518', '#0f0f11', '#0f0f11', '#020203'),  # one step darker: the floor
    'brass': ('#c9a96a',) * 4,                                       # --brass
    'ivory': ('#ece6d8',) * 4,                                       # --text
}
BG = '#09090a'      # --bg
IVORY = '#ece6d8'   # --text: the edge lines in the previews

SEGMENTS = 20       # round things (the mug, the stool, the lamp)


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
        mat.diffuse_color = srgb(PREVIEW_TONES[name][0])
        MATERIALS[name] = mat
    return MATERIALS[name]


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mesh_object(name, bm, location, mat=None):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = link(bpy.data.objects.new(name, mesh))
    obj.location = location
    if mat:
        mesh.materials.append(material(mat))
    return obj


def cuboid(w, d, h):
    """A box w (x) by d (y) by h (z), centred on its origin."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    return bm


def cylinder(r, h, segments=SEGMENTS, r_top=None):
    """An upright cylinder (or a cone frustum with r_top) of height h, centred on its origin."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r,
                          radius2=r if r_top is None else r_top, depth=h)
    return bm


def torus(major, minor, major_segments=72, minor_segments=8):
    """A ring lying flat (in the XY plane), centred on its origin."""
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


def col(name, x, y, z0, z1, w, d, **props):
    """A collision box (COL_<name>) from z0 to z1, centred on (x, y) across: invisible in the game."""
    obj = mesh_object(f'COL_{name}', cuboid(w, d, z1 - z0), (x, y, (z0 + z1) / 2))
    obj.display_type = 'WIRE'
    for key, value in props.items():
        obj[key] = value
    return obj


def block(name, x, y, z0, z1, w, d, mat='obsidian', route=None):
    """A box that is both scenery and solid: the mesh and its COL_ twin."""
    mesh_object(name, cuboid(w, d, z1 - z0), (x, y, (z0 + z1) / 2), mat)
    props = {'route': route} if route is not None else {}
    return col(name, x, y, z0, z1, w, d, **props)


# -------------------------------------------------------------------------------------------------------------- the climb
#
# (x, y) is the middle of a piece across, z0 to z1 its height, w and d its size along x and y. The agent starts on the floor
# at SPAWN, facing the desk (+Y). Every step of the route is checked against the jump in src/game/ascent/level.vitest.ts:
# at most 1.28 m up, and a gap within 80% of the jump's reach (about 2.6 m going up 1.2 m, 3.4 m on the level).

DESK_TOP = 6.0


def build_climb():
    # The floor: a 48 m square, its top at 0.
    mesh_object('floor', cuboid(48, 48, 1), (0, 0, -0.5), 'obsidian-dark')
    col('floor', 0, 0, -1, 0, 48, 48, ground=1)

    # 1-2. Two books lying on the floor, one on the other.
    block('book_low', -3.0, -6.0, 0.0, 0.8, 3.2, 2.4, route=1)
    block('book_high', -3.3, -5.6, 0.8, 1.6, 2.8, 2.0, route=2)

    # 3. A round stool: the seat is the solid; the legs are scenery the agent can walk between.
    mesh_object('stool_seat', cylinder(1.1, 0.3), (-6.5, -2.8, 2.45), 'obsidian')
    col('stool_seat', -6.5, -2.8, 2.3, 2.6, 1.6, 1.6, route=3)
    for i, (dx, dy) in enumerate(((-0.6, -0.6), (0.6, -0.6), (-0.6, 0.6), (0.6, 0.6))):
        block(f'stool_leg_{i}', -6.5 + dx, -2.8 + dy, 0.0, 2.3, 0.2, 0.2)

    # 4-5. A chair turned round, its back to the desk: the seat, then the top of the back (a beam 0.4 m deep).
    block('chair_seat', -4.0, 1.0, 3.2, 3.6, 3.0, 3.0, route=4)
    for i, (dx, dy) in enumerate(((-1.3, -1.3), (1.3, -1.3), (-1.3, 1.3), (1.3, 1.3))):
        block(f'chair_leg_{i}', -4.0 + dx, 1.0 + dy, 0.0, 3.2, 0.3, 0.3)
    block('chair_back', -4.0, 2.7, 3.6, 4.8, 3.0, 0.4, route=5)

    # 6. The desk: its top 14 m by 6 m, on four legs.
    block('desk_top', 0.0, 7.0, DESK_TOP - 0.5, DESK_TOP, 14.0, 6.0, route=6)
    for i, (x, y) in enumerate(((-6.6, 4.4), (6.6, 4.4), (-6.6, 9.6), (6.6, 9.6))):
        block(f'desk_leg_{i}', x, y, 0.0, DESK_TOP - 0.5, 0.6, 0.6)

    # 7. A keyboard on the desk, its keys a few raised rows.
    block('keyboard', -0.5, 5.8, DESK_TOP, DESK_TOP + 0.35, 5.0, 1.6, route=7)
    for row in range(3):
        mesh_object(f'keyboard_keys_{row}', cuboid(4.4, 0.3, 0.08), (-0.5, 5.3 + row * 0.5, DESK_TOP + 0.39), 'obsidian')

    # 8. A mug: round, so its solid is a square a little inside it; the handle is scenery.
    mesh_object('mug', cylinder(0.9, 1.5), (4.5, 6.5, DESK_TOP + 0.75), 'obsidian')
    col('mug', 4.5, 6.5, DESK_TOP, DESK_TOP + 1.5, 1.6, 1.6, route=8)
    mesh_object('mug_handle', cuboid(0.5, 0.25, 0.9), (5.55, 6.5, DESK_TOP + 0.8), 'obsidian')

    # 9-10. Two books standing upright at the back of the desk.
    block('book_upright_a', 4.8, 9.1, DESK_TOP, DESK_TOP + 2.6, 2.4, 1.0, route=9)
    block('book_upright_b', 1.5, 9.3, DESK_TOP, DESK_TOP + 3.6, 2.0, 1.0, route=10)

    # 11. The monitor: walk along its top edge (0.5 m deep). The stand is solid too.
    block('monitor', -2.75, 8.75, DESK_TOP + 1.0, DESK_TOP + 4.6, 5.5, 0.5, route=11)
    block('monitor_neck', -2.75, 9.2, DESK_TOP + 0.2, DESK_TOP + 1.0, 0.8, 0.4)
    block('monitor_base', -2.75, 9.2, DESK_TOP, DESK_TOP + 0.2, 2.6, 1.4)

    # 12-13. A desk lamp: a round base, a post, an arm, and the head with its shade.
    mesh_object('lamp_base', cylinder(0.8, 0.2), (-6.5, 9.4, DESK_TOP + 0.1), 'obsidian')
    col('lamp_base', -6.5, 9.4, DESK_TOP, DESK_TOP + 0.2, 1.2, 1.2)
    mesh_object('lamp_post', cylinder(0.15, 4.8, segments=12), (-6.5, 9.4, DESK_TOP + 2.6), 'obsidian')
    col('lamp_post', -6.5, 9.4, DESK_TOP + 0.2, DESK_TOP + 5.0, 0.3, 0.3)
    block('lamp_arm', -7.5, 9.4, DESK_TOP + 5.0, DESK_TOP + 5.6, 2.6, 1.0, route=12)
    mesh_object('lamp_hinge', cylinder(0.2, 0.4, segments=12), (-8.6, 9.4, DESK_TOP + 5.8), 'obsidian')
    mesh_object('lamp_shade', cylinder(1.3, 0.9, r_top=0.9), (-9.6, 9.4, DESK_TOP + 6.15), 'obsidian')
    col('lamp_shade', -9.6, 9.4, DESK_TOP + 5.7, DESK_TOP + 6.6, 1.8, 1.8, route=13)

    # The agent starts on the floor in front of the books, facing the desk.
    spawn = link(bpy.data.objects.new('SPAWN', None))
    spawn.empty_display_type = 'ARROWS'
    spawn.location = (0.0, -10.0, 0.0)  # not turned: the agent faces +Y; a turn about Z would turn it

    # The goal: the brass ring over the lamp, tilted like the ring in the logo.
    goal = mesh_object('GOAL', torus(2.2, 0.07), (-9.6, 9.4, DESK_TOP + 9.5), 'brass')
    goal.rotation_euler = (0.42, 0, 0)
    bpy.context.view_layer.update()


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
        export_normals=False,
        export_tangents=False,
        export_materials='EXPORT',
        export_attributes=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_animations=False,
        export_draco_mesh_compression_enable=False,
        export_image_format='NONE',
    )
    try:
        bpy.ops.export_scene.gltf(export_vertex_color='NONE', **options)
    except TypeError:
        bpy.ops.export_scene.gltf(**options)


def report():
    objects = list(bpy.context.scene.objects)
    meshes = [o for o in objects if o.type == 'MESH']
    cols = [o for o in meshes if o.name.startswith('COL_')]
    route = sorted((o['route'], o.name) for o in cols if 'route' in o)
    tris = sum(len(p.vertices) - 2 for o in meshes if o not in cols for p in o.data.polygons)
    size = os.path.getsize(OUT_GLB)
    print(f'TEST CLIMB: {len(meshes) - len(cols)} scenery meshes ({tris} triangles), {len(cols)} COL_ boxes, '
          f'{len(route)} route blocks, {size} bytes -> {OUT_GLB}')
    for n, name in route:
        print(f'  route {n:2d}: {name}')
    assert [n for n, _ in route] == list(range(1, len(route) + 1)), 'route numbers must run 1, 2, 3, ... with no gaps'
    for o in cols:
        assert all(abs(a) < 1e-6 for a in o.rotation_euler), f'{o.name} is rotated: collision boxes are axis-aligned'


# ------------------------------------------------------------------------------------------------------------- preview
#
# Stills for the author's approval (CLAUDE.md: generated images need it), close to the game's look: each face painted the
# tone the game gives it (tops lightest, the two pairs of sides a step apart), ivory lines on the edges, an obsidian
# background. Workbench, so it renders anywhere; no fog. Written to tools/ascent/out/ (not in git), with the .blend.

def paint_tones(meshes):
    for obj in meshes:
        mat = obj.data.materials[0].name if obj.data.materials else 'obsidian'
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


def edge_lines(meshes):
    """Thin ivory copies of each mesh's sharp edges (a wireframe of its flat faces merged), standing in for the game's lines."""
    mat = bpy.data.materials.new('preview_lines')
    mat.diffuse_color = srgb(IVORY)
    for obj in meshes:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(25), verts=bm.verts, edges=bm.edges)
        mesh = bpy.data.meshes.new(obj.name + '_lines')
        bm.to_mesh(mesh)
        bm.free()
        lines = link(bpy.data.objects.new(obj.name + '_lines', mesh))
        lines.matrix_world = obj.matrix_world
        mod = lines.modifiers.new('wire', 'WIREFRAME')
        mod.thickness = 0.035
        mod.use_replace = True
        mesh.materials.append(mat)
        attr = mesh.color_attributes.new('tone', 'FLOAT_COLOR', 'CORNER')
        for d in attr.data:
            d.color = srgb(IVORY)


def preview():
    os.makedirs(OUT_DIR, exist_ok=True)
    scene = bpy.context.scene
    visible = [o for o in scene.objects if o.type == 'MESH' and not o.name.startswith('COL_') and o.name != 'floor']
    floor = scene.objects['floor']
    for o in scene.objects:
        if o.name.startswith('COL_'):
            o.hide_render = True
    paint_tones(visible + [floor])
    edge_lines(visible)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, 'test-climb.blend'))

    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.view_settings.view_transform = 'Standard'
    shading = scene.display.shading
    shading.light = 'FLAT'
    shading.color_type = 'VERTEX'
    shading.background_type = 'WORLD'
    scene.world = bpy.data.worlds.new('preview')
    scene.world.color = srgb(BG)[:3]
    scene.display.render_aa = '8'

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 28
    cam_data.clip_end = 300
    cam = link(bpy.data.objects.new('cam', cam_data))
    scene.camera = cam
    views = {
        # Over the agent's shoulder at the start, as the game's camera begins.
        'start': (Vector((0.0, -16.0, 3.2)), Vector((0.0, -10.0, 1.3))),
        # The whole climb from the front left.
        'overview': (Vector((14.0, -22.0, 16.0)), Vector((-2.0, 5.0, 6.0))),
        # From the desk top, looking up at the monitor, the lamp and the ring.
        'top': (Vector((6.0, -2.0, 12.0)), Vector((-6.0, 9.0, 11.0))),
    }
    for name, (pos, target) in views.items():
        cam.location = pos
        cam.rotation_euler = (target - pos).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(OUT_DIR, f'test-climb-{name}.png')
        bpy.ops.render.render(write_still=True)
        print(f'PREVIEW -> {scene.render.filepath}')


def main():
    reset_scene()
    build_climb()
    export()
    report()
    if '--preview' in ARGS:
        preview()


main()
