# ---------------------------------------------------------------------------
# GLB -> Mixamo-ready package. Emits:
#   <out>.fbx  (rigged, embedded textures when the exporter honors it)
#   <out>.obj + .mtl + albedo.png (the Mixamo zip fallback)
#   <out>.zip  (obj + mtl + albedo, ready to upload)
# usage: blender --background --python tools/glb-to-mixamo.py -- <in.glb> <out_base>
# ---------------------------------------------------------------------------
import bpy, sys, os, zipfile, shutil

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

# ---- FBX with the rig (Mixamo's preferred upload) --------------------------
fbx_path = OUT + '.fbx'
kwargs = dict(filepath=fbx_path, use_selection=False, add_leaf_bones=False,
              bake_anim=False, object_types={'ARMATURE', 'MESH'})
try:
    bpy.ops.export_scene.fbx(embed_textures=True, path_mode='AUTO', **kwargs)
    print('[mixamo] fbx with embedded textures ->', fbx_path)
except TypeError:
    bpy.ops.export_scene.fbx(**kwargs)
    print('[mixamo] fbx (textures external) ->', fbx_path)

# ---- OBJ + albedo zip (the documented fallback) ----------------------------
obj_path = OUT + '.obj'
bpy.ops.wm.obj_export(filepath=obj_path, export_selected_objects=False,
                      export_materials=True, export_uv=True, export_normals=True)
print('[mixamo] obj ->', obj_path)

# find the albedo (base color) image and pack it beside the obj
albedo = None
for img in bpy.data.images:
    n = (img.name or '').lower()
    if 'normal' in n or 'metallic' in n or 'roughness' in n:
        continue
    albedo = img
    break
zip_path = OUT + '_mixamo.zip'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(obj_path, os.path.basename(obj_path))
    mtl = os.path.splitext(obj_path)[0] + '.mtl'
    if os.path.exists(mtl):
        z.write(mtl, os.path.basename(mtl))
    if albedo:
        png = OUT + '_albedo.png'
        albedo.filepath_raw = png
        albedo.file_format = 'PNG'
        albedo.save()
        z.write(png, os.path.basename(png))
print('[mixamo] zip ->', zip_path)
print('[mixamo] DONE — upload the .fbx first; if it refuses, upload the .zip')
