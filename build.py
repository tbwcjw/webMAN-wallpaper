import os
import shutil

included_paths = [
    'css/',
    'font/',
    'img/',
    'js/',
    'index.html',
    'project.json',
    'preview.jpg'
]

source_dir = '.'
target_dir = '../wm_interg_worksh'
exclude_file = '.keep'

def copy_path(rel_path, src_base, dst_base):
    src_path = os.path.join(src_base, rel_path)

    if os.path.isfile(src_path):
        if os.path.basename(src_path) == exclude_file:
            return
        dst_path = os.path.join(dst_base, rel_path)
        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
        shutil.copy2(src_path, dst_path)
        print(f"Copied file: {rel_path}")

    elif os.path.isdir(src_path):
        for root, _, files in os.walk(src_path):
            for file in files:
                if file == exclude_file:
                    continue
                full_file_path = os.path.join(root, file)
                rel_file_path = os.path.relpath(full_file_path, src_base)
                dst_file_path = os.path.join(dst_base, rel_file_path)
                os.makedirs(os.path.dirname(dst_file_path), exist_ok=True)
                shutil.copy2(full_file_path, dst_file_path)
                print(f"Copied file: {rel_file_path}")
    else:
        print(f"Warning: {rel_path} not found or not a regular file/directory.")

for path in included_paths:
    copy_path(path, source_dir, target_dir)