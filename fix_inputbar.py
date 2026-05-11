import sys, os

path = r'c:\SDG_1_backend\frontend\src\components\chat\InputBar.tsx'
out_path = r'c:\SDG_1_backend\fix_result.txt'

try:
    with open(path, encoding='utf-8') as f:
        content = f.read()
    
    lines = content.splitlines(keepends=True)
    total = len(lines)
    
    # Find where the duplicate starts: look for the second occurrence of 
    # 'export interface PendingAttachment {'
    occ = 0
    cut_at = None
    for i, line in enumerate(lines):
        if line.strip() == 'export interface PendingAttachment {':
            occ += 1
            if occ == 2:
                # Also trim any blank lines before this
                cut_at = i
                while cut_at > 0 and lines[cut_at - 1].strip() == '':
                    cut_at -= 1
                break
    
    with open(out_path, 'w') as f:
        f.write(f"Total lines: {total}\n")
        f.write(f"Occurrences of PendingAttachment found: {occ}\n")
        if cut_at is not None:
            f.write(f"Will cut at line {cut_at + 1} (0-indexed: {cut_at})\n")
            f.write(f"Line {cut_at}: {repr(lines[cut_at])}\n")
        else:
            f.write("No duplicate found!\n")
    
    if cut_at is not None:
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(lines[:cut_at])
        with open(out_path, 'a') as f:
            f.write("File successfully truncated!\n")
    
except Exception as e:
    with open(out_path, 'w') as f:
        f.write(f"ERROR: {e}\n")
        import traceback
        traceback.print_exc(file=f)
