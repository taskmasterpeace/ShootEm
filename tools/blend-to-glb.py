# Headless .blend -> .glb batch converter (Quaternius packs ship .blend only,
# and three.js eats glTF). One Blender session, looped, so we pay startup once.
#
#   blender -b --python tools/blend-to-glb.py -- <srcRoot> <outDir> <file.blend> ...
#
# Exports MESHES ONLY (the packs ship a camera + lamp in every file, and we
# light the scene ourselves), applies modifiers, and drops everything at the
# origin so the game can place it on a tile.
import bpy, sys, os

argv = sys.argv[sys.argv.index('--') + 1:]
src_root, out_dir, files = argv[0], argv[1], argv[2:]
os.makedirs(out_dir, exist_ok=True)

ok, failed = 0, []
for rel in files:
    path = os.path.join(src_root, rel)
    name = os.path.splitext(os.path.basename(rel))[0]
    out = os.path.join(out_dir, name + '.glb')
    try:
        bpy.ops.wm.open_mainfile(filepath=path)
        # keep meshes only — no packaged camera/lamp riding along
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        if not meshes:
            failed.append((name, 'no mesh'))
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.export_scene.gltf(
            filepath=out, export_format='GLB', use_selection=True,
            export_apply=True,          # bake modifiers
            export_yup=True,            # three.js is Y-up
            export_cameras=False, export_lights=False,
        )
        ok += 1
    except Exception as e:  # noqa: BLE001 — report and keep going
        failed.append((name, str(e)[:80]))

print(f'CONVERTED {ok}/{len(files)}')
for n, why in failed:
    print(f'  FAILED {n}: {why}')
