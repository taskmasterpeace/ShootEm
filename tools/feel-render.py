# ---------------------------------------------------------------------------
# FEEL-PASS PROOF SHEET — renders the turn flip (snap vs spring), the hold
# variants, and the flight silhouettes from feel-proof.json.
#   blender --background --python tools/feel-render.py -- <proof.json> <out_dir>
# ---------------------------------------------------------------------------
import bpy, sys, os, json, math

argv = sys.argv[sys.argv.index('--') + 1:]
PROOF, OUT = argv[0], argv[1]
os.makedirs(OUT, exist_ok=True)
proof = json.load(open(PROOF))
GLB = os.path.join(os.path.dirname(PROOF), '..', '..', 'public', 'models', 'soldier_infantry.glb')

def fresh_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    nodes = {o.name: o for o in bpy.data.objects}
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.rotation_euler = (math.radians(55), 0, math.radians(35))
    bpy.context.collection.objects.link(sun)
    tgt = bpy.data.objects.new('aim', None)
    bpy.context.collection.objects.link(tgt)
    tgt.location = (0, 0, 1.0)
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
    sc.render.resolution_x = sc.render.resolution_y = 420
    return nodes, cam

def shoot(cam, name, loc=(0, -3.4, 1.1)):
    cam.location = loc
    bpy.context.scene.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)

def toy_rifle(pos, rotz=0.0):
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(pos[0], pos[1], pos[2]))
    root = bpy.context.object
    root.name = 'gun'
    root.rotation_euler = (0, rotz, 0)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    rec = bpy.context.object
    rec.scale = (0.34, 0.05, 0.045)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.37, 0.005, 0))
    bar = bpy.context.object
    bar.scale = (0.21, 0.028, 0.028)
    for o in (rec, bar):
        o.parent = root
        m = bpy.data.materials.new('gunmetal')
        m.diffuse_color = (0.12, 0.12, 0.1, 1)
        o.data.materials.append(m)
    return root

# ---- 1. THE TURN: snap vs spring, 4 frames each -----------------------------
sel = [0, 1, 2, 3]
for tag, series in [('snap', proof['snap']), ('spring', proof['spring'])]:
    for i, fi in enumerate(sel):
        nodes, cam = fresh_scene()
        yaw = series[fi]
        # a single root carries the whole body — the turn is ONE rotation
        bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
        root = bpy.context.object
        for o in nodes.values():
            if o.parent is None:
                o.parent = root
        gun = toy_rifle((0.42, 0.16, 1.28))
        gun.parent = root
        root.rotation_euler = (0, 0, -yaw)  # game yaw (X-forward) → blender Z-up
        shoot(cam, f'turn_{tag}_f{proof["frames"][fi]}')

# ---- 2. THE HOLDS: rifle / pistol / shotgun / rocket -------------------------
for fam in ['rifle', 'pistol', 'shotgun', 'at_rocket']:
    h = proof['holds'][fam]
    nodes, cam = fresh_scene()
    # solved grip baseline (approx: the game's solve angles) + the family delta
    base = {'armR': -0.5, 'armL': -0.75}
    for jn, base_a, delta in [('armR', base['armR'], h['armR']), ('armL', base['armL'], h['armL'])]:
        o = nodes.get(jn)
        if o:
            o.rotation_euler = (0, base_a + delta, 0)
    toy_rifle((0.42 + h['gunZ'], 0.16, 1.28 + h['gunY']), h['gunRotZ'])
    shoot(cam, f'hold_{fam}')

# ---- 3. THE FLIGHTS: inferno / stormcaller / gargoyle -----------------------
for fid, p in proof['flights'].items():
    nodes, cam = fresh_scene()
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    root = bpy.context.object
    for o in nodes.values():
        if o.parent is None:
            o.parent = root
    for jn, z, x in [('armL', p['armZ'], p['armX']), ('armR', p['armZ'], -p['armX'])]:
        o = nodes.get(jn)
        if o:
            o.rotation_euler = (x, -z, 0)
    o = nodes.get('head')
    if o:
        o.rotation_euler = (0, -p['headZ'], 0)
    # pitch the whole body into the flight attitude
    root.rotation_euler = (p['pitch'], 0, 0)
    shoot(cam, f'flight_{fid}', loc=(0, -3.6, 1.6))

print('[feel-render] DONE ->', OUT)
