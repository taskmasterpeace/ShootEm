# ---------------------------------------------------------------------------
# GRIP/GAIT RENDER PROOF — pose the game's GLB trooper with the dumped joint
# angles (tools/grip-visual-proof.ts) and render before/after frames.
#   blender --background --python tools/grip-render.py -- <proof.json> <out_dir>
# ---------------------------------------------------------------------------
import bpy, sys, os, json, math

argv = sys.argv[sys.argv.index('--') + 1:]
PROOF, OUT = argv[0], argv[1]
os.makedirs(OUT, exist_ok=True)
proof = json.load(open(PROOF))

GLB = os.path.join(os.path.dirname(PROOF), '..', '..', 'public', 'models', 'soldier_infantry.glb')

def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    return {o.name: o for o in bpy.data.objects}

def toy_rifle(gun_pos):
    # a simple rifle silhouette: receiver + barrel + grip
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    rec = bpy.context.object
    rec.scale = (0.34, 0.05, 0.045)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.37, 0.005, 0))
    bar = bpy.context.object
    bar.scale = (0.21, 0.028, 0.028)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.15, -0.06, 0))
    grp = bpy.context.object
    grp.scale = (0.03, 0.06, 0.03)
    for o in (rec, bar, grp):
        o.data.materials.append(bpy.data.materials.new('gunmetal'))
        o.data.materials[0].diffuse_color = (0.12, 0.12, 0.1, 1)
    # parent to an empty at gun position
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=gun_pos)
    root = bpy.context.object
    root.name = 'gun'
    for o in (rec, bar, grp):
        o.parent = root
    return root

def pose_rigid(nodes, name, rx, ry, rz):
    o = nodes.get(name)
    if not o:
        return
    # the game bakes three-space into the mesh; node rotations are local
    o.rotation_mode = 'XYZ'
    o.rotation_euler = (rx, ry, rz)

def setup_scene():
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.rotation_euler = (math.radians(55), 0, math.radians(35))
    bpy.context.collection.objects.link(sun)
    tgt = bpy.data.objects.new('aim', None)
    bpy.context.collection.objects.link(tgt)
    tgt.location = (0, 0, 0.9)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    bpy.context.collection.objects.link(cam)
    con = cam.constraints.new('TRACK_TO')
    con.target = tgt
    con.track_axis = 'TRACK_NEGATIVE_Z'
    con.up_axis = 'UP_Y'
    bpy.context.scene.camera = cam
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.render.resolution_x = sc.render.resolution_y = 520
    return cam

def shoot(cam, name, loc):
    cam.location = loc
    bpy.context.scene.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)

VIEWS = {
    'front': (0, -3.2, 1.0),
    'three': (-2.4, -2.2, 1.2),
    'side': (-3.2, 0, 1.0),
}

# ---------------- BEFORE: legacy fixed pose --------------------------------
nodes = load()
gun = toy_rifle((proof['before']['gun']['x'], -proof['before']['gun']['z'], proof['before']['gun']['y']))
cam = setup_scene()
for vn, loc in VIEWS.items():
    shoot(cam, f'before_{vn}', loc)

# ---------------- AFTER: solved grip + run frame ---------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
nodes = {o.name: o for o in bpy.data.objects}
a = proof['after']
gun = toy_rifle((a['gun']['x'], -a['gun']['z'], a['gun']['y']))
# NOTE: game is X-forward/Y-up; blender is Z-up — map (x, y, z)game -> (x, -z, y)
for jn, ang in [('armR', a['armR']), ('armL', a['armL'])]:
    o = nodes.get(jn)
    if o:
        o.rotation_mode = 'XYZ'
        o.rotation_euler = (ang['x'], -ang['z'], ang['y'])
run = a['run']
for jn, val in [('legL', run['legL']), ('legR', run['legR']), ('shinL', run['shinL']), ('shinR', run['shinR'])]:
    o = nodes.get(jn)
    if o:
        o.rotation_mode = 'XYZ'
        o.rotation_euler = (0, -val, 0)
for jn, val in [('torso', run['torsoX']), ('head', run['headX'])]:
    o = nodes.get(jn)
    if o:
        o.rotation_mode = 'XYZ'
        o.rotation_euler = (val, 0, 0)
cam = setup_scene()
for vn, loc in VIEWS.items():
    shoot(cam, f'after_{vn}', loc)
print('[grip-render] DONE ->', OUT)
