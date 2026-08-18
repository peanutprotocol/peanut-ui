// generate-ds-tokens.mjs — /dev/ds foundations data generated from the @theme
// token source in src/styles/globals.css, so the docs cannot drift from the
// real values (the hand-typed colors doc had 6/12 swatches wrong).
//
//   node scripts/generate-ds-tokens.mjs           # write tokens.generated.ts
//   node scripts/generate-ds-tokens.mjs --check   # exit 1 if the file is stale
//
// parseThemeTokens() is exported so other emitters (mono/design components.md,
// DS 08) can reuse the same parse instead of re-reading the css.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import prettier from 'prettier'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CSS_PATH = path.join(ROOT, 'src/styles/globals.css')
const OUT_PATH = path.join(ROOT, 'src/app/(mobile-ui)/dev/ds/foundations/tokens.generated.ts')

// the @theme block is organized by banner comments; tokens are classified by
// which banner they appear under. if a banner is renamed the parse fails loud.
const SECTION_BANNERS = [
    ['legacy', 'LEGACY PALETTE'],
    ['semantic', 'SEMANTIC TOKENS'],
    ['parity', 'v3-parity theme values'],
]

// longest-first so --transition-duration-* doesn't match as shadow/etc.
const NAMESPACES = [
    'default-transition',
    'transition-duration',
    'border-width',
    'font-weight',
    'animate',
    'drop-shadow',
    'spacing',
    'radius',
    'shadow',
    'color',
    'text',
    'font',
    'blur',
    'ease',
]

export function parseThemeTokens(css) {
    const start = css.indexOf('@theme {')
    if (start === -1) throw new Error('no @theme block found in globals.css')
    const end = css.indexOf('\n}', start)
    if (end === -1) throw new Error('unterminated @theme block')
    const block = css.slice(start, end)

    const sections = SECTION_BANNERS.map(([name, banner]) => {
        const offset = block.indexOf(banner)
        if (offset === -1) throw new Error(`section banner "${banner}" not found in @theme — update SECTION_BANNERS`)
        return { name, offset }
    })
    const sectionAt = (offset) => {
        let current = sections[0].name
        for (const s of sections) if (offset >= s.offset) current = s.name
        return current
    }

    // blank comments (preserving offsets) so tokens named inside prose don't parse
    const blanked = block.replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length))

    const colors = []
    const textByName = new Map()
    const fontByName = new Map()
    const groups = {}

    for (const m of blanked.matchAll(/--([a-zA-Z0-9*-]+)\s*:\s*([^;]+);/g)) {
        const [, rawName, rawValue] = m
        if (rawName.includes('*')) continue // wildcard resets like --color-red-*: initial
        const value = rawValue.replace(/\s+/g, ' ').trim()
        const section = sectionAt(m.index)

        const ns = NAMESPACES.find((n) => rawName === n || rawName.startsWith(n + '-'))
        if (!ns) throw new Error(`unknown @theme namespace in --${rawName} — teach scripts/generate-ds-tokens.mjs`)
        const rest = rawName === ns ? '' : rawName.slice(ns.length + 1)

        if (ns === 'color') {
            colors.push({ name: rest, value, section })
        } else if (ns === 'text') {
            // --text-<name> plus --text-<name>--<modifier> lines form one style
            const [name, modifier] = rest.split('--')
            const style = textByName.get(name) ?? { name, section }
            if (!modifier) style.fontSize = value
            else if (modifier === 'line-height') style.lineHeight = value
            else if (modifier === 'font-weight') style.fontWeight = value
            else style[modifier.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
            textByName.set(name, style)
        } else if (ns === 'font') {
            const [name, modifier] = rest.split('--')
            const font = fontByName.get(name) ?? { name, section }
            if (!modifier) font.stack = value
            else font[modifier.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
            fontByName.set(name, font)
        } else {
            ;(groups[ns] ??= []).push({ name: rest, value, section })
        }
    }

    const tokens = {
        colors,
        textStyles: [...textByName.values()],
        fonts: [...fontByName.values()],
        groups,
    }

    // sanity floors — a silently-broken parse must not write an empty doc
    if (tokens.colors.length < 50) throw new Error(`parsed only ${tokens.colors.length} colors — parse broken?`)
    if (tokens.textStyles.length < 10) throw new Error(`parsed only ${tokens.textStyles.length} text styles`)
    if (tokens.fonts.length < 2) throw new Error(`parsed only ${tokens.fonts.length} fonts`)
    return tokens
}

export async function renderTokensModule(tokens) {
    const j = (v) => JSON.stringify(v, null, 4)
    const source = `// generated from the @theme block in src/styles/globals.css by
// scripts/generate-ds-tokens.mjs — DO NOT EDIT. run \`pnpm gen:ds-tokens\`.
// a jest drift test (scripts/__tests__/ds-tokens-drift.test.js) fails CI when
// this file is stale.

/** which @theme banner the token sits under: legacy palette (v3 port, do not
 * use in new code), semantic (figma-verified, use these), or v3-parity shims. */
export type TokenSection = 'legacy' | 'semantic' | 'parity'

export interface ColorToken {
    name: string
    value: string
    section: TokenSection
}

export interface TextStyle {
    name: string
    section: TokenSection
    fontSize?: string
    lineHeight?: string
    fontWeight?: string
    [modifier: string]: string | undefined
}

export interface FontToken {
    name: string
    section: TokenSection
    stack?: string
    [modifier: string]: string | undefined
}

export const COLOR_TOKENS: ColorToken[] = ${j(tokens.colors)}

export const TEXT_STYLES: TextStyle[] = ${j(tokens.textStyles)}

export const FONT_TOKENS: FontToken[] = ${j(tokens.fonts)}

/** radius / shadow / blur / motion / spacing token groups, keyed by @theme namespace */
export const TOKEN_GROUPS: Record<string, ColorToken[]> = ${j(tokens.groups)}
`
    const config = await prettier.resolveConfig(OUT_PATH)
    return prettier.format(source, { ...config, filepath: OUT_PATH })
}

async function main() {
    const check = process.argv.includes('--check')
    const tokens = parseThemeTokens(fs.readFileSync(CSS_PATH, 'utf-8'))
    const rendered = await renderTokensModule(tokens)

    if (check) {
        const onDisk = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf-8') : ''
        if (onDisk !== rendered) {
            console.error('tokens.generated.ts is stale — run `pnpm gen:ds-tokens` and commit the result')
            process.exit(1)
        }
        console.log('tokens.generated.ts is in sync with globals.css')
        return
    }

    fs.writeFileSync(OUT_PATH, rendered)
    console.log(
        `wrote ${path.relative(ROOT, OUT_PATH)} — ${tokens.colors.length} colors, ` +
            `${tokens.textStyles.length} text styles, ${tokens.fonts.length} fonts, ` +
            `${Object.keys(tokens.groups).length} other groups`
    )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    await main()
}
