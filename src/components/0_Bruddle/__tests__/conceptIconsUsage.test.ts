// One icon and one bubble color per product concept, everywhere (TASK-23054).
// CONCEPT_ICONS holds each pair; a call site that types a concept's glyph with
// a color of its own drifts from every other surface. Hugo found one on
// 2026-09-25: the navbar QR was pink and the Accounts and payments QR row was
// green. This scan fails when a new call site hard-codes a concept glyph.
//
// Detection, per non-test source file outside the /dev pages:
//   1. <IconBubble>, <EmptyState> or <ActionModal> with a literal concept glyph
//      in `icon` (spread CONCEPT_ICONS, or pass `concept`, instead)
//   2. an object literal that pairs a literal concept glyph with a color field
//      (`color`, `iconColor`, `iconContainerClassName`)
//   3. a hand-rolled `rounded-full` container whose <Icon> is a concept glyph,
//      or a bubble drawing the rewards star (rewards = star on yellow)
//   4. `CONCEPT_ICONS.x.icon` taken without `CONCEPT_ICONS.x.color`: half a pair
//
// A glyph that is not the concept on that surface goes in EXEMPT with a reason.
// Do not weaken the detection.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { CONCEPT_ICONS } from '../conceptIcons'

const SRC = join(__dirname, '..', '..', '..')

const GLYPHS = [
    ...new Set(Object.values(CONCEPT_ICONS).flatMap(({ icon }) => (typeof icon === 'string' ? [icon] : []))),
]
// the rewards star is an image, so it has no icon name to match
const STAR = 'STAR_STRAIGHT_ICON|starStraight\\w*'
const GLYPH = `(?:${GLYPHS.map((g) => g.replace(/[-]/g, '\\-')).join('|')})`

// `path (relative to src/) :: glyph`, sorted. Each entry needs a reason.
const EXEMPT = new Map<string, string>([
    [
        'components/Global/BottomNav/index.tsx :: qr-code',
        'the nav QR button is the reference: action-primary, the same pink as the qrPay brand fill',
    ],
    [
        'components/Home/GettingStartedChecklist.tsx :: arrow-up',
        'first payment opens /send; it shares the withdraw glyph (design decision pending)',
    ],
    ['components/Migration/ScanToDownloadModal.tsx :: qr-code', 'a QR that downloads the app, not QR pay'],
    [
        'features/deposit-accounts/components/ClaimAccountScreen.tsx :: link',
        'an explainer bullet about a shareable account link, not a send or request link',
    ],
    [
        'features/payments/flows/semantic-request/SemanticRequestPageWrapper.tsx :: link',
        'the gray error state for a broken payment URL (design decision pending)',
    ],
])

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full)
        return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
    })
}

const files = sourceFiles(SRC)
    .map((full) => relative(SRC, full).split(sep).join('/'))
    .filter((path) => !path.startsWith('app/(mobile-ui)/dev/') && path !== 'components/0_Bruddle/conceptIcons.tsx')

const RULES: RegExp[] = [
    // 1. a component that draws a bubble, given a literal concept glyph
    new RegExp(`<(?:IconBubble|EmptyState|ActionModal)\\b[^<>]*?\\bicon=\\{?["'](${GLYPH})["']`, 'g'),
    // 2. one object literal pairing a concept glyph with a color
    new RegExp(`\\{[^{}]*\\bicon:\\s*["'](${GLYPH})["'][^{}]*\\b(?:color|iconColor|iconContainerClassName):`, 'g'),
    new RegExp(`\\{[^{}]*\\b(?:color|iconColor|iconContainerClassName):[^{}]*\\bicon:\\s*["'](${GLYPH})["']`, 'g'),
    // 3. a hand-rolled round container around a concept glyph
    new RegExp(`rounded-full[^\\n]*\\n(?:[^\\n]*\\n){0,2}[^\\n]*<Icon\\s+name=["'](${GLYPH})["']`, 'g'),
    // the rewards star in a bubble of its own instead of CONCEPT_ICONS.rewards
    new RegExp(`rounded-full[^\\n]*\\n(?:[^\\n]*\\n){0,2}[^\\n]*src=\\{(${STAR})\\b`, 'g'),
    new RegExp(`<IconBubble\\b[^>]*?\\bicon=\\{<Image[^>]*?src=\\{(${STAR})\\b`, 'g'),
]

function violations(path: string): string[] {
    const source = readFileSync(join(SRC, path), 'utf8')
    const found = RULES.flatMap((rule) => [...source.matchAll(rule)].map((m) => `${path} :: ${m[1]}`))
    // 4. half a pair: the concept's icon without its color
    for (const m of source.matchAll(/CONCEPT_ICONS\.(\w+)\.icon\b/g)) {
        if (!source.includes(`CONCEPT_ICONS.${m[1]}.color`)) found.push(`${path} :: CONCEPT_ICONS.${m[1]}.icon`)
    }
    return [...new Set(found)].filter((key) => !EXEMPT.has(key))
}

describe('product concept bubbles come from CONCEPT_ICONS', () => {
    test('the scan sees the source tree', () => {
        expect(files.length).toBeGreaterThan(500)
        expect(GLYPHS).toContain('qr-code')
    })

    test('no call site hard-codes a concept icon or color', () => {
        expect(files.flatMap(violations)).toEqual([])
    })

    test('every exemption still matches a call site', () => {
        const unexempted = (path: string) => {
            const saved = new Map(EXEMPT)
            EXEMPT.clear()
            try {
                return violations(path)
            } finally {
                saved.forEach((reason, key) => EXEMPT.set(key, reason))
            }
        }
        const live = new Set(files.flatMap(unexempted))
        expect([...EXEMPT.keys()].filter((key) => !live.has(key))).toEqual([])
    })

    // the detector itself: each rule catches the shape it names
    test.each([
        ['<IconBubble icon="qr-code" color="green" />'],
        ['<EmptyState icon="coins" title="x" />'],
        ["{ icon: 'bank', color: 'blue' }"],
        ["{ iconContainerClassName: 'bg-action-primary', icon: 'credit-card' }"],
        ['<div className="rounded-full bg-blue-500">\n    <Icon name="link" size={24} />'],
        [
            '<div className="rounded-full bg-background-icon-bubble-green">\n    <Image src={STAR_STRAIGHT_ICON} alt="" />',
        ],
        ['<IconBubble icon={<Image src={STAR_STRAIGHT_ICON} alt="" />} color="green" />'],
    ])('flags %s', (snippet) => {
        expect(RULES.some((rule) => new RegExp(rule.source).test(snippet))).toBe(true)
    })

    test.each([['<IconBubble {...CONCEPT_ICONS.qrPay} size="s" />'], ["{ icon: 'alert', color: 'yellow' }"]])(
        'passes %s',
        (snippet) => {
            expect(RULES.some((rule) => new RegExp(rule.source).test(snippet))).toBe(false)
        }
    )
})
