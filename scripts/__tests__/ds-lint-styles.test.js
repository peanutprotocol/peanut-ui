/** @jest-environment node */

const { cssUseSites, countAlphaSemanticTokens } = require('../ds-lint-styles.cjs')
const { copyFileSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

test('css scanning reads declarations and apply rules, not definitions, selectors or comments', () => {
    expect(
        cssUseSites(`
            /* @apply bg-n-1; color: #bad; */
            @theme inline { --color-action-primary: #ff90e8; @keyframes pulse { to { color: #fff; } } }
            @utility space-y-7 { & > * { margin: 1rem; } }
            .text-sm { @apply px-5\n bg-action-primary/20; color: #fff; }
        `)
    ).toEqual({
        apply: 'px-5\n bg-action-primary/20',
        declarations: '1rem\n#fff',
        classLists: ['px-5\n bg-action-primary/20'],
    })
})

test('invalid css fails instead of silently skipping a file', () => {
    expect(() => cssUseSites('.bad { color: #fff')).toThrow()
})

const tokens = new Set(['action-primary', 'foreground-primary', 'background-default', 'border-default'])
test.each([
    'bg-action-primary/10',
    'hover:bg-action-primary/[0.15]',
    'border-t-border-default/50',
    'bg-(--color-action-primary)/20',
    'bg-(color:--color-action-primary)/20',
    'drop-shadow-action-primary/20',
    'text-shadow-action-primary/20',
    'bg-[var(--color-action-primary)]/(--opacity)',
    'bg-[color:var(--color-action-primary)]/20',
    'bg-foreground-primary/10',
    '"animate-pulse bg-foreground-primary/20"',
    '"animate-pulse-strong bg-foreground-primary/10"',
    '"animate-pulse hover:bg-foreground-primary/10"',
    'from-action-primary/10 to-transparent',
    'background: color-mix(in srgb, var(--color-action-primary) 10%, transparent)',
    'background: --alpha(var(--color-action-primary) / 10%)',
    'background: theme(--color-action-primary / 10%)',
    'background: rgb(from var(--color-action-primary) r g b / .5)',
])('counts unapproved semantic color alpha: %s', (text) => {
    expect(countAlphaSemanticTokens(text, tokens)).toBe(1)
})

test.each([
    '"animate-pulse bg-foreground-primary/10"',
    'bg-action-primary text-body-s/5 w-1/2 opacity-40',
    'bg-black/80',
    'background: var(--color-action-primary)',
    'background: rgb(from var(--color-action-primary) r g b)',
    'color-mix(in srgb, red 10%, transparent); color: var(--color-action-primary)',
])('leaves opaque tokens and the exact skeleton exception alone: %s', (text) => {
    expect(countAlphaSemanticTokens(text, tokens)).toBe(0)
})

test('counts each use and does not exempt a whole file containing a skeleton', () => {
    expect(
        countAlphaSemanticTokens(
            'const skeleton = "animate-pulse bg-foreground-primary/10"; const card = "bg-foreground-primary/10"',
            tokens
        )
    ).toBe(1)
    expect(countAlphaSemanticTokens('bg-action-primary/10 text-foreground-primary/50', tokens)).toBe(2)
})

test.each([
    "const styles = { skeleton: 'animate-pulse', card: 'bg-foreground-primary/10' }",
    '<><div className="animate-pulse" /><div className="bg-foreground-primary/10" /></>',
    '/* animate-pulse */ const card = "bg-foreground-primary/10"',
    'const card = "hover:animate-pulse bg-foreground-primary/10"',
    'const card = `${active ? "animate-pulse" : ""} bg-foreground-primary/10`',
])('does not share skeleton exceptions across class sites: %s', (source) => {
    expect(countAlphaSemanticTokens(source, tokens)).toBe(1)
})

test('exempts a complete skeleton class string, including multiline templates', () => {
    expect(countAlphaSemanticTokens('const skeleton = `animate-pulse\n bg-foreground-primary/10`', tokens)).toBe(0)
    expect(countAlphaSemanticTokens('const skeleton = "animate-pulse bg-foreground-primary/10"', tokens)).toBe(0)
})

test('scopes css skeleton exceptions to one apply rule, including multiline rules', () => {
    const { classLists } = cssUseSites(`
        .skeleton { @apply animate-pulse\n bg-foreground-primary/10; }
        .pulse { @apply animate-pulse; } .card { @apply bg-foreground-primary/10; }
        .hover { @apply animate-pulse hover:bg-foreground-primary/10; }
    `)
    expect(classLists.map((value) => countAlphaSemanticTokens(value, tokens, { classList: true }))).toEqual([
        0, 0, 1, 1,
    ])
})

test('the real ratchet rejects new css and typescript alpha uses outside globals.css', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-styles-'))
    try {
        mkdirSync(join(dir, 'src/styles'), { recursive: true })
        mkdirSync(join(dir, 'scripts'))
        for (const file of [
            'ds-lint-counts.mjs',
            'ds-lint-rules.cjs',
            'ds-lint-ast.cjs',
            'ds-lint-expressions.cjs',
            'ds-lint-styles.cjs',
        ]) {
            copyFileSync(join(__dirname, '..', file), join(dir, 'scripts', file))
        }
        symlinkSync(resolve(__dirname, '../../node_modules'), join(dir, 'node_modules'), 'dir')
        writeFileSync(
            join(dir, 'src/styles/globals.css'),
            '@theme { --color-action-primary: #ff90e8; --color-foreground-primary: #000; }'
        )
        const run = (flag) =>
            spawnSync(process.execPath, [join(dir, 'scripts/ds-lint-counts.mjs'), flag], { encoding: 'utf8' })
        const initial = run('--json')
        if (initial.status !== 0) throw new Error(initial.stderr)
        expect(initial.status).toBe(0)
        const baseline = JSON.parse(initial.stdout)
        expect(baseline.rawHex).toBe(0)
        expect(baseline.alphaSemanticToken).toBe(0)
        writeFileSync(join(dir, 'scripts/ds-lint-baseline.json'), JSON.stringify(baseline))
        expect(run('--check').status).toBe(0)
        writeFileSync(
            join(dir, 'src/extra.css'),
            `.test { @apply bg-action-primary/20 p-5 text-sm; color: #abc; }
             .skeleton { @apply animate-pulse\n bg-foreground-primary/10; }
             .pulse { @apply animate-pulse; } .card { @apply bg-foreground-primary/10; }`
        )
        writeFileSync(
            join(dir, 'src/example.tsx'),
            "const styles = { skeleton: 'animate-pulse', card: 'bg-foreground-primary/10' }"
        )
        const measured = run('--json')
        expect(measured.status).toBe(0)
        expect(JSON.parse(measured.stdout)).toMatchObject({
            rawHex: 1,
            rawHexFiles: 1,
            stockTextSize: 1,
            offScaleSpacing: 1,
            alphaSemanticToken: 3,
        })
        const checked = run('--check')
        expect(checked.status).toBe(1)
        expect(checked.stderr).toContain('alphaSemanticToken')
        expect(checked.stderr).toContain('rawHex')
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})
