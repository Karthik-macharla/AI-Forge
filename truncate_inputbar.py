path = 'c:/SDG_1_backend/frontend/src/components/chat/InputBar.tsx'
with open(path, encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# Find the second occurrence of "export interface PendingAttachment {"
# The first is at the top (line 2), the second is the duplicate
count = 0
cut_at = None
for i, line in enumerate(lines):
    if line.strip() == 'export interface PendingAttachment {':
        count += 1
        if count == 2:
            cut_at = i
            break

print(f"Found duplicate PendingAttachment at line {cut_at + 1 if cut_at is not None else 'not found'}")

if cut_at is not None:
    # Remove the blank lines before cut_at too (going backwards)
    while cut_at > 0 and lines[cut_at - 1].strip() == '':
        cut_at -= 1
    print(f"Will keep lines 1-{cut_at} (0-indexed: 0-{cut_at-1})")
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines[:cut_at])
    print("Done!")
else:
    print("No duplicate found - file may already be clean")
