# figma anatomy specs (distilled) — do not commit

## Modal — anatomy 17800:57224 / board 17800:57216
container: bg background/default, border 1px border/default #161616, radius xs=4px, p=xl 24px, flex col, gap xl 24px, w 358
top group: flex col, gap l 16px, w-full
icon row: flex, gap 0, items-start, justify-center; IconBubble instance = p 12px + icon 24 (= size M, 48px box), bg iconbubble/yellow
close btn: absolute, size 40, rounded round, icon 20, top -24
text group: flex col, gap xs 4px, items-center, w-full
  title: Heading/XS = 20px / w800 / lh 24
  desc instance: 16px / w500 / lh20 (= Body/M); ANNOTATION says "Body S"  <-- MISMATCH
cta group: flex col, gap 12px (m), items-center, w-full
legend: A=spacing L(16) B=spacing S(8) C=spacing XL(24)
ANNOTATION says "Icon Bubble, size S" but instance is size M <-- MISMATCH

## IconBubble — 17312:137951 (board 17802:61528)
radius full 999px
| size | pad | icon | box |
| xs | 4  | 16 | 24 |
| S  | 8  | 16 | 32 |
| M  | 12 | 24 | 48 |
| L  | 16 | 40 | 72 |
logo variant: p0, box 24/32/48/64
colors: yellow #ffc900, green #29cc6a, blue #90a8ed, gray #d1d5db
CODE: l icon = 32 (should be 40). xs/s/m all match.

## Button — 17308:134480 (board 17802:61527)
shape rounded round 999px; border 1px border/button; shadow 4px on Primary+Secondary; Ghost none
| size | h(board) | px | gap | text | icon |
| L | 48 (py m=12 + lh 24) | xl 24 | s 8 | Button/L 18/700/24 | 24 |
| M | 40 | m 12 | s 8 | Button/M 16/700/16 | 20 |
| S | 38 | s 8 | xs 4 | Button/S 14/700/14 | 16 |
leading icon L: pl m=12 pr xl=24 (asymmetric)
Primary bg action/primary, hover action/primary-hover
Secondary bg background/default, border foreground/primary (S: border/button-secondary)
Ghost: no bg/border, no px except OnlyIcon px=s

CODE: text-button-l/m/s tokens all MATCH exactly.
CODE heights: l=48 OK; m=44 (board 40); s=40+pseudo (board 38) -> deliberate touch-target law, documented in globals.css + design.md. FLAG not fix.
CODE buttonIconSizes = {s:16, m:16, l:18}  -> board {S:16, M:20, L:24}. l=18 is off the 16/20/24 icon scale entirely. FIX.
