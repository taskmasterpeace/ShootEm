# ---------------------------------------------------------------------------
# THE MODEL-REPLACEMENT PIPELINE — AI-generated GLB -> game-ready model.
#
#   "D:\Program Files\Blender Foundation\Blender 5.1\blender.exe" \
#       --background --python tools/soldier-pipeline.py -- \
#       <input.glb> <output.glb> --mode soldier|statue \
#       [--pose attention|rally] [--height 1.8] [--depth 5] [--flip]
#
# soldier mode: segments the body into the game's EIGHT NAMED JOINTS
#   (head/torso/armL/armR/legL/legR + shinL/shinR nested under the legs),
#   pivots at the game skeleton's heights, arms posed down, voxel-remeshed
#   per part, texture baked to vertex colors. The animator (renderer.ts)
#   finds parts by name and swings them — gait, ragdoll, melee all work.
# statue mode: one welded piece on the same rails (the memorial's recipe).
#
# HARD-WON LAWS BAKED IN (each cost a debugging session):
#   · renders LIE about orientation; the SKIN-COLOR HISTOGRAM doesn't —
#     the face cluster must sit above 75% height, else flip.
#   · collapse-decimate SHREDS noisy AI meshes; remesh-to-BLOCKS + planar
#     dissolve keeps the silhouette and the budget.
#   · the glTF exporter parks its Y-up conversion ON THE NODE, where
#     mount-time code trips over it — so we bake THREE-SPACE COORDINATES
#     into the mesh data and export with export_yup=False. What you bake
#     is what the game gets. Node translations carry ONLY the joint pivots.
# ---------------------------------------------------------------------------
import bpy, sys, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = argv[0], argv[1]
def opt(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
MODE = opt('--mode', 'soldier')
POSE = opt('--pose', 'attention')
HEIGHT = float(opt('--height', '1.8' if MODE == 'soldier' else '1.116'))
# soldiers remesh PER PART — each part gets its own octree, so the same
# depth lands ~4× finer than a whole-body pass. 4 keeps the 1200 budget.
DEPTH = int(opt('--depth', '4' if MODE == 'soldier' else '5'))
FLIP = '--flip' in argv

log = lambda *a: print('[pipeline]', *a)

# ---- clean scene, import ---------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
src_obj = next(o for o in bpy.data.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = src_obj
me = src_obj.data
log('imported', SRC, 'tris', sum(len(p.vertices) - 2 for p in me.polygons))

# ---- orient upright, face +X (self-checked, never trusted) -----------------
me.transform(Matrix.Rotation(math.radians(90), 4, 'Z') @ Matrix.Rotation(math.radians(90), 4, 'X'))
me.transform(Matrix.Rotation(math.radians(180), 4, 'X'))
def replant():
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    me.transform(Matrix.Translation(Vector((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs)))))
replant()
H = max(v.co.z for v in me.vertices)

# the arm band (widest |y|) must sit ABOVE 60% height on an upright figure
arm_zs = [v.co.z for v in me.vertices if abs(v.co.y) > 0.4 * max(abs(v.co.y) for v in me.vertices)]
if arm_zs and sum(arm_zs) / len(arm_zs) < 0.6 * H:
    log('arm band low -> flipping upright')
    me.transform(Matrix.Rotation(math.radians(180), 4, 'X')); replant()
if FLIP:
    me.transform(Matrix.Rotation(math.radians(180), 4, 'X')); replant()

# face +X: the chest rig carries more mass forward than the pack carries back
midH = [v for v in me.vertices if 0.5 * H < v.co.z < 0.9 * H]
front = sum(1 for v in midH if v.co.x > 0.05)
back = sum(1 for v in midH if v.co.x < -0.05)
if back > front:
    log('facing -X -> yaw 180')
    me.transform(Matrix.Rotation(math.radians(180), 4, 'Z')); replant()

# ---- bake texture -> corner colors (before any UV-destroying op) -----------
# THE image is whatever feeds Base Color — these GLBs carry three (albedo,
# metal-rough, normal) and grabbing the wrong one paints the soldier
# normal-map LAVENDER. Follow the link; fall back to the largest image.
img = None
for ms in src_obj.material_slots:
    if ms.material and ms.material.node_tree:
        for n in ms.material.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                links = n.inputs['Base Color'].links
                if links and links[0].from_node.type == 'TEX_IMAGE':
                    img = links[0].from_node.image
if img is None:
    imgs = [n.image for ms in src_obj.material_slots if ms.material and ms.material.node_tree
            for n in ms.material.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]
    img = max(imgs, key=lambda i: i.size[0] * i.size[1], default=None)
if img is None:
    print('[pipeline] FATAL: no texture image found'); raise SystemExit(1)
log('base color image:', img.name)
work = img.copy(); work.scale(1024, 1024)
px = work.pixels[:]
W, Hh = work.size
uvl = me.uv_layers.active.data
col = me.color_attributes.new(name='Col', type='BYTE_COLOR', domain='CORNER')
for li in range(len(me.loops)):
    u, v = uvl[li].uv
    x = min(W - 1, max(0, int((u % 1.0) * W))); y = min(Hh - 1, max(0, int((v % 1.0) * Hh)))
    i = (y * W + x) * 4
    col.data[li].color = (px[i], px[i + 1], px[i + 2], 1.0)
bpy.data.images.remove(work)
log('colors baked')

# self-check: the face (biggest skin cluster) lives in the top quarter
skin_zs = []
for poly in me.polygons:
    for li in poly.loop_indices:
        r, g, b, a = col.data[li].color
        if r > 0.55 and g > 0.35 and r > g > b:
            skin_zs.append(me.vertices[me.loops[li].vertex_index].co.z)
high_skin = sum(1 for z in skin_zs if z > 0.75 * H)
low_skin = sum(1 for z in skin_zs if z < 0.25 * H)
log('skin corners: high', high_skin, 'low', low_skin)
if low_skin > high_skin * 2:
    raise SystemExit('ORIENTATION FAILED skin check — rerun with --flip')

# ---- pose the arms (T-pose -> hanging / rally) ------------------------------
shZ = 0.78 * H
torso_half = 0.19 * max(abs(v.co.y) for v in me.vertices) / 0.53 if False else 0.19
arms = [(v, 1) for v in me.vertices if v.co.y > torso_half and v.co.z > 0.55 * H] + \
       [(v, -1) for v in me.vertices if v.co.y < -torso_half and v.co.z > 0.55 * H]
for v, side in arms:
    # rally pose: the RIGHT arm (side -1, the -y side) punches skyward;
    # everything else drops to attention
    up = POSE == 'rally' and side == -1
    ang = math.radians((60 if up else -75) * side)
    pivot = Vector((0, side * torso_half, shZ))
    v.co = pivot + Matrix.Rotation(ang, 4, 'X') @ (v.co - pivot)
me.update()
log('arms posed:', POSE, len(arms), 'verts')

# ---- scale to game height, feet at 0 ---------------------------------------
me.transform(Matrix.Scale(HEIGHT / H, 4))
replant()
H = max(v.co.z for v in me.vertices)
log('scaled to', round(H, 3))

# ---- segmentation plan (soldier) or whole (statue) --------------------------
# game skeleton pivots (fractions of the 1.8 trooper): hip .533, knee .289,
# shoulder .833, neck .90 — cuts at the pivots so swings look human
PIV = { 'hip': 0.533 * H, 'knee': 0.289 * H, 'shoulder': 0.833 * H, 'neck': 0.90 * H }
ARM_Y = 0.28 * H / 1.8 * 1.8  # |y| beyond this at shoulder height = arm
def classify(c):
    # blender +y maps to three -z (B2T), and the game hangs the LEFT limbs
    # at three +z — so blender-left is NEGATIVE y. Getting this backwards
    # once cost a --swap-lr flag; the signs below are the law.
    if MODE == 'statue': return 'torso'
    if c.z >= PIV['neck']: return 'head'
    if abs(c.y) > 0.17 * H and c.z > 0.52 * H:
        return 'armL' if c.y < 0 else 'armR'
    if c.z < PIV['hip']:
        leg = 'L' if c.y < 0 else 'R'
        return ('shin' + leg) if c.z < PIV['knee'] else ('leg' + leg)
    return 'torso'

# joint pivot (in blender Z-up space) per part — mesh verts become RELATIVE
# to this, node translation carries it (converted to three space at the end)
def pivot_of(part):
    if part == 'head': return Vector((0, 0, PIV['neck']))
    if part in ('armL', 'armR'): return Vector((0, (-1 if part == 'armL' else 1) * 0.17 * H, PIV['shoulder']))
    if part in ('legL', 'legR'): return Vector((0, (-1 if part == 'legL' else 1) * 0.08 * H, PIV['hip']))
    if part in ('shinL', 'shinR'): return Vector((0, (-1 if part == 'shinL' else 1) * 0.08 * H, PIV['knee']))
    return Vector((0, 0, 0))

# ---- split: assign polys to parts, separate, remesh each, recolor ----------
parts = {}
if MODE == 'statue':
    # a COPY, never the source — the remesh destroys color attributes, and
    # the recolor step reads them back off the intact source
    dup = src_obj.copy(); dup.data = src_obj.data.copy(); dup.name = 'statue'
    bpy.context.collection.objects.link(dup)
    parts['torso'] = dup
    src_obj.hide_set(True)
else:
    # tag polygons by their center's part
    names = ['head', 'torso', 'armL', 'armR', 'legL', 'legR', 'shinL', 'shinR']
    poly_part = [classify(p.center) for p in me.polygons]
    counts = {n: poly_part.count(n) for n in names}
    log('part polys:', counts)
    for name in names:
        if counts[name] == 0:
            print(f'[pipeline] FATAL: part {name} came up EMPTY — check cuts')
            raise SystemExit(1)
    # duplicate the source once per part, delete the other polys
    for name in names:
        dup = src_obj.copy(); dup.data = src_obj.data.copy(); dup.name = name
        bpy.context.collection.objects.link(dup)
        dme = dup.data
        keep = set(i for i in range(len(dme.polygons)) if poly_part[i] == name)
        bpy.context.view_layer.objects.active = dup
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='DESELECT')
        bpy.ops.object.mode_set(mode='OBJECT')
        for i, p in enumerate(dme.polygons): p.select = i not in keep
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.delete(type='FACE')
        bpy.ops.object.mode_set(mode='OBJECT')
        parts[name] = dup
    src_obj.hide_set(True)

total_tris = 0
for name, ob in parts.items():
    bpy.context.view_layer.objects.active = ob
    # remesh to blocks (small parts get a finer octree so they survive)
    span = max(ob.dimensions)
    rm = ob.modifiers.new('rm', 'REMESH'); rm.mode = 'BLOCKS'
    rm.octree_depth = DEPTH if span > 0.5 else max(3, DEPTH - 1)
    rm.scale = 0.9; rm.use_remove_disconnected = False
    bpy.ops.object.modifier_apply(modifier='rm')
    dec = ob.modifiers.new('dec', 'DECIMATE'); dec.decimate_type = 'DISSOLVE'
    dec.angle_limit = math.radians(1)
    bpy.ops.object.modifier_apply(modifier='dec')
    # colors: nearest face on the posed, colored source
    src_cols = []
    sme = src_obj.data; scol = sme.color_attributes['Col'].data
    for poly in sme.polygons:
        r = g = b = 0
        for li in poly.loop_indices:
            c = scol[li].color; r += c[0]; g += c[1]; b += c[2]
        n = len(poly.loop_indices)
        src_cols.append((r / n, g / n, b / n))
    pme = ob.data
    pcol = pme.color_attributes.new(name='Col', type='BYTE_COLOR', domain='CORNER').data
    for poly in pme.polygons:
        hit, loc, nrm, fi = src_obj.closest_point_on_mesh(poly.center)
        r, g, b = src_cols[fi] if hit else (0.35, 0.32, 0.22)
        nz = poly.normal.z
        k = 1.0 + 0.22 * nz if nz >= 0 else 1.0 + 0.3 * nz  # sculpt the light in
        for li in poly.loop_indices:
            pcol[li].color = (min(1, r * k), min(1, g * k), min(1, b * k), 1.0)
    tris = sum(len(p.vertices) - 2 for p in pme.polygons)
    total_tris += tris
    log(name, 'tris', tris)
log('TOTAL TRIS', total_tris, '(budget 1200 soldier / 1500 statue)')

# ---- move each part into pivot-relative, THREE-SPACE coordinates ------------
# blender Z-up -> three Y-up: (x, y, z) -> (x, z, -y). Baked into the DATA,
# node rotation stays identity — the yup trap has nothing to grab.
B2T = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
for name, ob in parts.items():
    piv = pivot_of(name if MODE == 'soldier' else 'torso')
    ob.data.transform(Matrix.Translation(-piv))
    ob.data.transform(B2T)
    tp = B2T @ piv
    ob.location = tp
    ob.rotation_euler = (0, 0, 0); ob.scale = (1, 1, 1)

# nest shins under legs (game hierarchy: knee is the hip's child)
if MODE == 'soldier':
    for side in ('L', 'R'):
        shin, leg = parts['shin' + side], parts['leg' + side]
        world = shin.location.copy()
        shin.parent = leg
        shin.location = world - leg.location

# a simple vertex-color material shared by all parts
matl = bpy.data.materials.new('BodyColors')
matl.use_nodes = True
bsdf = matl.node_tree.nodes['Principled BSDF']
vc = matl.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
matl.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.85
for ob in parts.values():
    ob.data.materials.clear(); ob.data.materials.append(matl)

# ---- export ------------------------------------------------------------------
bpy.ops.object.select_all(action='DESELECT')
for ob in parts.values(): ob.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=DST, export_format='GLB', use_selection=True,
    export_yup=False,  # coordinates are ALREADY three-space — pass through raw
    export_apply=False, export_texcoords=False, export_normals=True,
    export_materials='EXPORT',
)
import os
log('exported', DST, round(os.path.getsize(DST) / 1024, 1), 'KB')
log('NOW RUN: node tools/glb-strip-rotations.mjs ' + DST)
log('(the exporter parks a rotation on every node no matter what you ask;')
log(' the strip is not optional — an unstripped model arrives EXPLODED)')
