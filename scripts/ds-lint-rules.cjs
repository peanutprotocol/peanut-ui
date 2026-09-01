// composition-drift matchers shared by ds-lint-counts.mjs and its regression
// tests (scripts/__tests__/ds-lint-rules.test.ts). the counting script has
// top-level side effects (it walks src/), so the rules live here where a test
// can import them without running the scan. CommonJS on purpose: node's ESM
// loader named-imports it statically, and jest's CJS runtime requires it with
// no transform.

// allowlist inversion, not a blocklist: tailwind v4 compiles ANY numeric step
// (p-4.5, pr-18, -mt-5, ps-5), so the metric flags every numeric spacing
// utility — negative forms, variant prefixes, the logical inline (ps/pe/ms/me)
// and block-axis (pbs/pbe/mbs/mbe) families, and the 1px `-px` suffix — whose
// magnitude is not a documented scale step. arbitrary values (p-[5px]) and
// custom-property shorthand (p-(--gutter)) are rejected wholesale: a value
// that equals a scale step has a numeric class, so those forms are always drift.
const SPACING_STEPS = new Set(['0', '0.5', '1', '2', '3', '4', '6', '8', '10', '12', '14', '16'])
const SPACING_FAMILIES =
    'pbs|pbe|px|py|pt|pb|pl|pr|ps|pe|p|mbs|mbe|mx|my|mt|mb|ml|mr|ms|me|m|gap-x|gap-y|gap|space-y|space-x'
const NUMERIC_SPACING_RE = new RegExp(
    `(?<![a-z0-9-])-?(?:${SPACING_FAMILIES})-([0-9]+(?:\\.[0-9]+)?|px)(?![0-9.a-z%\\]])`,
    'g'
)
const ARBITRARY_SPACING_RE = new RegExp(`(?<![a-z0-9-])-?(?:${SPACING_FAMILIES})-(?:\\[[^\\]]+\\]|\\(--[^)]+\\))`, 'g')

function countOffScaleSpacing(text) {
    let n = 0
    for (const m of text.matchAll(NUMERIC_SPACING_RE)) if (!SPACING_STEPS.has(m[1])) n++
    n += (text.match(ARBITRARY_SPACING_RE) ?? []).length
    return n
}

// a type token carries its own weight, so a weight utility stacked next to one
// mints an off-ramp style. matching happens per className expression (the
// attribute's full string or brace-balanced JSX expression), so a token and a
// weight split across formatted lines inside one twMerge/clsx call still
// count; class strings held in variables outside className= are caught by a
// per-line pass over the remaining text.
// stock weight names + the theme's own extraBlack (globals.css
// --font-weight-extraBlack, registered in tw.ts) + arbitrary numeric brackets
// (decimals included) + the font-(weight:…) custom-property form. bare
// font-(--x) is a font-FAMILY custom property, not a weight — excluded.
const WEIGHT_STACK_RE =
    /\bfont-(?:thin|extralight|light|normal|medium|semibold|extrabold|extraBlack|bold|black|\[[0-9]+(?:\.[0-9]+)?\]|\(weight:[^)]+\))(?![a-zA-Z0-9-])/
const TYPE_TOKEN_RE = /\btext-(?:body|heading|label|button)-[a-z-]+\b/

function classNameExpressions(text) {
    const regions = []
    // any JSX prop ending in ClassName (titleClassName, iconClassName, …)
    // carries classes into an element, so all of them are scanned.
    const re = /\b[a-zA-Z]*[cC]lassName\s*=\s*/g
    let m
    while ((m = re.exec(text))) {
        const i = re.lastIndex
        const c = text[i]
        if (c === '"' || c === "'") {
            const end = text.indexOf(c, i + 1)
            if (end === -1) continue
            regions.push({ start: i, end: end + 1 })
            re.lastIndex = end + 1
        } else if (c === '{') {
            let depth = 1
            let j = i + 1
            while (j < text.length && depth > 0) {
                if (text[j] === '{') depth++
                else if (text[j] === '}') depth--
                j++
            }
            regions.push({ start: i, end: j })
            re.lastIndex = j
        }
    }
    return regions
}

// class-builder calls (twMerge('text-body-m', active && 'font-semibold')
// assigned to a variable) produce class lists outside any *ClassName
// attribute, so their paren-balanced argument spans are regions too.
function builderCallRegions(text) {
    const regions = []
    const re = /\b(?:twMerge|clsx|cn|classNames|cva|tw)\s*\(/g
    let m
    while ((m = re.exec(text))) {
        let depth = 1
        let j = re.lastIndex
        while (j < text.length && depth > 0) {
            if (text[j] === '(') depth++
            else if (text[j] === ')') depth--
            j++
        }
        regions.push({ start: m.index, end: j })
        re.lastIndex = j
    }
    return regions
}

function countWeightStacks(text) {
    let n = 0
    const attrRegions = classNameExpressions(text)
    const inAttr = (r) => attrRegions.some((a) => r.start >= a.start && r.end <= a.end)
    const regions = [...attrRegions, ...builderCallRegions(text).filter((r) => !inAttr(r))].sort(
        (a, b) => a.start - b.start
    )
    for (const r of regions) {
        const expr = text.slice(r.start, r.end)
        if (TYPE_TOKEN_RE.test(expr) && WEIGHT_STACK_RE.test(expr)) n++
    }
    let rest = ''
    let cursor = 0
    for (const r of regions) {
        if (r.start < cursor) continue
        rest += text.slice(cursor, r.start)
        cursor = r.end
    }
    rest += text.slice(cursor)
    for (const line of rest.split('\n')) if (TYPE_TOKEN_RE.test(line) && WEIGHT_STACK_RE.test(line)) n++
    return n
}

// three ways an Icon gets sized: the size prop (also width/height, which the
// component forwards), Button's iconSize, and — banned outright by the icon
// law — tailwind size-/h-/w- classes on the Icon itself, whatever the
// className syntax (string, template literal, or brace expression): any
// size-/h-/w- numeric class inside an <Icon …> tag span counts.
const OFF_SCALE_ICON_RE =
    /<Icon\s[^>]*?\b(?:size|width|height)=\{(?!16\}|20\}|24\})[0-9]+\}|\biconSize=\{(?!16\}|20\}|24\})[0-9]+\}|<Icon\s[^>]*?\b(?:size|h|w)-(?:[0-9]|\[|\(--)/g

// allowlist inversion like spacing: any rounded suffix outside the documented
// scale (bare rounded = 4px/xs, none, sm = 2px, round, full) is drift —
// named steps (md/lg/xl…) and arbitrary values (rounded-[1px]) alike.
const RADIUS_SIDES = '(?:t|r|b|l|tl|tr|bl|br|s|e|ss|se|es|ee)'
const RADIUS_RE = new RegExp(
    `\\brounded(?:-${RADIUS_SIDES})?(?:-(\\[[^\\]]+\\]|\\(--[^)]+\\)|[a-z0-9.]+))?(?![a-z0-9-])`,
    'g'
)
const RADIUS_ALLOWED = new Set([undefined, 'none', 'sm', 'round', 'full'])

function countOffScaleRadius(text) {
    let n = 0
    for (const m of text.matchAll(RADIUS_RE)) if (!RADIUS_ALLOWED.has(m[1])) n++
    return n
}

// any numeric duration is off-token (the motion scale is instant/fast/
// moderate/slow); arbitrary values (duration-[250ms]) count too.
const RAW_DURATION_RE = /\bduration-(?:[0-9]+\b|\[[^\]]+\]|\(--[^)]+\))/g

module.exports = {
    SPACING_STEPS,
    NUMERIC_SPACING_RE,
    ARBITRARY_SPACING_RE,
    countOffScaleSpacing,
    countWeightStacks,
    countOffScaleRadius,
    OFF_SCALE_ICON_RE,
    RAW_DURATION_RE,
}
