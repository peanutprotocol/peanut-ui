import { readFileSync } from 'fs'
import { join } from 'path'
import { twMerge as stockTwMerge } from 'tailwind-merge'
import { twMerge } from '../tw'

// Every base type token declared in the @theme block, e.g. `--text-body-m: …`
// but not its `--text-body-m--line-height` / `--font-weight` companions.
const typeTokens = () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8')
    const found = new Set<string>()
    for (const m of css.matchAll(/^\s*--text-([a-z0-9-]+):/gm)) {
        const name = m[1]
        if (name.includes('--')) continue
        found.add(name)
    }
    return [...found]
}

describe('twMerge (DS-configured)', () => {
    // The bug this file exists for: the activity-row amount rendered at weight
    // 400 because the type token was dropped, and the source still read right.
    test('keeps a type token next to a text colour', () => {
        expect(twMerge('text-body-m-semibold text-foreground-primary')).toBe(
            'text-body-m-semibold text-foreground-primary'
        )
        // proves the test would have caught the original bug
        expect(stockTwMerge('text-body-m-semibold text-foreground-primary')).toBe('text-foreground-primary')
    })

    // Drift guard: a new family added to the @theme block fails here rather
    // than silently disappearing at some call site months later.
    test('every --text-* token in globals.css survives a merge with a colour', () => {
        const tokens = typeTokens()
        expect(tokens.length).toBeGreaterThan(20)
        const dropped = tokens.filter((t) => !twMerge(`text-${t} text-foreground-primary`).includes(`text-${t}`))
        expect(dropped).toEqual([])
    })

    test('still resolves genuine conflicts — last size and last colour win', () => {
        expect(twMerge('text-body-s text-body-m')).toBe('text-body-m')
        expect(twMerge('text-foreground-secondary text-foreground-primary')).toBe('text-foreground-primary')
        expect(twMerge('text-sm text-body-m')).toBe('text-body-m')
    })

    test('leaves non-typography merging alone', () => {
        expect(twMerge('p-2 p-4')).toBe('p-4')
        expect(twMerge('flex items-center', 'items-start')).toBe('flex items-start')
    })
})
