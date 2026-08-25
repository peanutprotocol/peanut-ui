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

    // The other direction of the same bug: nothing is dropped, the caller's
    // override is silently ignored because stock tailwind-merge does not know
    // `rounded-round` is a radius, so both classes survive and css order wins.
    describe('custom radius tokens', () => {
        test('a caller radius overrides a component radius, both ways', () => {
            expect(twMerge('rounded-round rounded-sm')).toBe('rounded-sm')
            expect(twMerge('rounded-sm rounded-round')).toBe('rounded-round')
            expect(twMerge('rounded-round rounded-full')).toBe('rounded-full')
            // proves the test would have caught the original behaviour
            expect(stockTwMerge('rounded-round rounded-sm')).toBe('rounded-round rounded-sm')
        })

        test('every --radius-* token in globals.css merges as a radius', () => {
            const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8')
            const tokens = [...css.matchAll(/^\s*--radius-([a-z0-9-]+):/gm)].map((m) => m[1])
            expect(tokens.length).toBeGreaterThan(2)
            const unmerged = tokens.filter((t) => twMerge(`rounded-${t} rounded-none`) !== 'rounded-none')
            expect(unmerged).toEqual([])
        })

        // side-specific radii still win over the shorthand, as in stock
        test('keeps the corner-specific radii working', () => {
            expect(twMerge('rounded-round rounded-t-sm')).toBe('rounded-round rounded-t-sm')
            expect(twMerge('rounded-t-sm rounded-round')).toBe('rounded-round')
        })
    })
})
