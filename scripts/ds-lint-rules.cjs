// composition-drift matchers shared by ds-lint-counts.mjs and its regression
// tests (scripts/__tests__/ds-lint-rules.test.ts). the counting script has
// top-level side effects (it walks src/), so the rules live here where a test
// can import them without running the scan. CommonJS on purpose: node's ESM
// loader named-imports it statically, and jest's CJS runtime requires it with
// no transform.

// allowlist inversion, not a blocklist: tailwind v4 compiles ANY numeric step
// (p-4.5, pr-18, -mt-5, ps-5), so the metric flags every numeric spacing
// utility — negative forms, variant prefixes, and the logical ps/pe/ms/me
// families included — whose magnitude is not a documented scale step.
const SPACING_STEPS = new Set(['0', '0.5', '1', '2', '3', '4', '6', '8', '10', '12', '14', '16'])
const NUMERIC_SPACING_RE =
    /(?<![a-z0-9-])-?(?:px|py|pt|pb|pl|pr|ps|pe|p|mx|my|mt|mb|ml|mr|ms|me|m|gap-x|gap-y|gap|space-y|space-x)-([0-9]+(?:\.[0-9]+)?)(?![0-9.a-z%\]])/g

function countOffScaleSpacing(text) {
    let n = 0
    for (const m of text.matchAll(NUMERIC_SPACING_RE)) if (!SPACING_STEPS.has(m[1])) n++
    return n
}

// three ways an Icon gets sized: the size prop (also width/height, which the
// component forwards), Button's iconSize, and — banned outright by the icon
// law — tailwind size-/h-/w- classes on the Icon itself.
const OFF_SCALE_ICON_RE =
    /<Icon\s[^>]*?\b(?:size|width|height)=\{(?!16\}|20\}|24\})[0-9]+\}|\biconSize=\{(?!16\}|20\}|24\})[0-9]+\}|<Icon\s[^>]*?className="[^"]*\b(?:size|h|w)-[0-9]/g

const OFF_SCALE_RADIUS_RE = /\brounded(?:-[trbl]{1,2})?-(?:md|lg|xl|2xl|3xl)\b/g

// any numeric duration is off-token (the motion scale is instant/fast/
// moderate/slow); arbitrary values (duration-[250ms]) count too.
const RAW_DURATION_RE = /\bduration-(?:[0-9]+\b|\[[^\]]+\])/g

module.exports = {
    SPACING_STEPS,
    NUMERIC_SPACING_RE,
    countOffScaleSpacing,
    OFF_SCALE_ICON_RE,
    OFF_SCALE_RADIUS_RE,
    RAW_DURATION_RE,
}
