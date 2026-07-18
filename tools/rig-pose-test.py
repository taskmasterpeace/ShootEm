# ---------------------------------------------------------------------------
# DEFORMATION TEST — pose the rigged model's limbs and render frames, so we
# can SEE whether the skin weights are sane before anything downstream.
#   blender --background --python tools/rig-pose-test.py -- <in.glb> <out_dir>
# Emits pose_rest.png, pose_arms.png, pose_legs.png, pose_run.png (front+side)
# ---------------------------------------------------------------------------
import bpy, sys, os, math

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')

# pose helper: reset, then rotate named bones about the given local axis
def set_pose(rotations):
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
    for name, (ax, deg) in rotations.items():
        pb = arm.pose.bones.get(name)
        if not pb:
            print('[pose-test] MISSING BONE', name)
            continue
        e = list(pb.rotation_euler)
        e['XYZ'.index(ax)] = math.radians(deg)
        pb.rotation_euler = e

POSES = {
    'rest': {},
    'arms': {'bone_6': ('Z', -70), 'bone_10': ('Z', 70), 'bone_8': ('Z', -40), 'bone_12': ('Z', 40)},
    'legs': {'bone_14': ('Z', 45), 'bone_16': ('Z', -60), 'bone_18': ('Z', -30), 'bone_20': ('Z', 50)},
    'run': {'bone_14': ('Z', 40), 'bone_16': ('Z', -55), 'bone_18': ('Z', -35), 'bone_20': ('Z', 60),
            'bone_6': ('Z', -35), 'bone_10': ('Z', 35), 'bone_2': ('Z', 10)},
}

# camera + light rig — an empty at the figure's center the camera tracks,
# so the aim is always right regardless of axis conventions
tgt = bpy.data.objects.new('aim', None)
bpy.context.collection.objects.link(tgt)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
bpy.context.collection.objects.link(cam)
con = cam.constraints.new('TRACK_TO')
con.target = tgt
con.track_axis = 'TRACK_NEGATIVE_Z'
con.up_axis = 'UP_Y'

def shoot(name, loc):
    cam.location = loc
    bpy.context.scene.camera = cam
    bpy.context.scene.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)

sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
bpy.context.collection.objects.link(sun)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.render.resolution_x = sc.render.resolution_y = 480
sc.render.film_transparent = False

# frame the figure: bounds-driven
import mathutils
bb = [mesh.matrix_world @ mathutils.Vector(c) for c in mesh.bound_box]
xs = [v.x for v in bb]; ys = [v.y for v in bb]; zs = [v.z for v in bb]
cx, cy, cz = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2
span = max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))
tgt.location = (cx, cy, cz)
print(f'[pose-test] center=({cx:.2f},{cy:.2f},{cz:.2f}) span={span:.2f}')

for pname, rots in POSES.items():
    set_pose(rots)
    bpy.context.view_layer.update()
    shoot(f'pose_{pname}_front', (cx, cy - span * 2.0, cz))
    shoot(f'pose_{pname}_side', (cx - span * 2.0, cy, cz))
    print('[pose-test]', pname, 'rendered')
print('[pose-test] DONE ->', OUT)
