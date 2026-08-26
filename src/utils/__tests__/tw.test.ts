import { readFileSync } from 'fs'
import { join } from 'path'
import { twMerge as stockTwMerge } from 'tailwind-merge'
import { twMerge } from '../tw'

// Every base type token declared in the @theme block, e.g. `--text-body-m: …`
// but not its `--text-body-m--line-height` / `--font-weight` companions.
// [A-Z] included: `--text-headingLarge` is camelCase and a kebab-only regex
// left it out of the census, so the guard was blind to it being dropped.
const typeTokens = () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8')
    const found = new Set<string>()
    for (const m of css.matchAll(/^\s*--text-([a-zA-Z0-9-]+):/gm)) {
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

    // The camelCase tokens were invisible to both the tw.ts regex and the
    // census above, so they still merged as colours — same bug, second round.
    test('keeps a camelCase type token next to a text colour, sizes still conflict', () => {
        expect(twMerge('text-headingLarge text-foreground-primary')).toBe('text-headingLarge text-foreground-primary')
        expect(twMerge('text-headingLarge text-heading-s')).toBe('text-heading-s')
        expect(twMerge('text-heading-s text-headingMedium')).toBe('text-headingMedium')
    })

    // Drift guard: a new family added to the @theme block fails here rather
    // than silently disappearing at some call site months later.
    test('every --text-* token in globals.css survives a merge with a colour', () => {
        const tokens = typeTokens()
        expect(tokens.length).toBeGreaterThan(20)
        expect(tokens).toEqual(expect.arrayContaining(['headingLarge', 'headingMedium']))
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

    // `--font-weight-extraBlack` yields `font-extraBlack`, which stock
    // tailwind-merge treats as a font FAMILY — `font-sans` deleted the weight.
    describe('custom font-weight tokens', () => {
        test('a custom weight coexists with a family and conflicts with weights', () => {
            expect(twMerge('font-extraBlack font-sans')).toBe('font-extraBlack font-sans')
            expect(twMerge('font-extraBlack font-bold')).toBe('font-bold')
            expect(twMerge('font-bold font-extraBlack')).toBe('font-extraBlack')
            // proves the test would have caught the original behaviour
            expect(stockTwMerge('font-extraBlack font-sans')).toBe('font-sans')
        })

        test('every --font-weight-* token in globals.css merges as a weight', () => {
            const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8')
            const tokens = [...css.matchAll(/^\s*--font-weight-([a-zA-Z0-9-]+):/gm)].map((m) => m[1])
            expect(tokens.length).toBeGreaterThan(0)
            const unmerged = tokens.filter((t) => twMerge(`font-${t} font-bold`) !== 'font-bold')
            expect(unmerged).toEqual([])
        })
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

    const globalsCss = () => readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8')
    const cssTokens = (re: RegExp) => [...globalsCss().matchAll(re)].map((m) => m[1])

    // stock tailwind-merge has no theme scale for durations, so a custom token
    // and a stock step both survived and css order picked the duration.
    describe('custom duration tokens', () => {
        test('a duration token conflicts with stock durations, both ways', () => {
            expect(twMerge('duration-300 duration-fast')).toBe('duration-fast')
            expect(twMerge('duration-fast duration-300')).toBe('duration-300')
            // proves the test would have caught the original behaviour
            expect(stockTwMerge('duration-300 duration-fast')).toBe('duration-300 duration-fast')
        })

        test('every --transition-duration-* token in globals.css merges as a duration', () => {
            const tokens = cssTokens(/^\s*--transition-duration-([a-zA-Z0-9-]+):/gm)
            expect(tokens.length).toBeGreaterThan(2)
            const unmerged = tokens.filter((t) => twMerge(`duration-${t} duration-300`) !== 'duration-300')
            expect(unmerged).toEqual([])
        })
    })

    describe('custom ease tokens', () => {
        test('a custom ease conflicts with stock eases', () => {
            expect(twMerge('ease-in-out ease-spring')).toBe('ease-spring')
            expect(twMerge('ease-spring ease-in-out')).toBe('ease-in-out')
            expect(stockTwMerge('ease-in-out ease-spring')).toBe('ease-in-out ease-spring')
        })

        test('every --ease-* token in globals.css merges as an ease', () => {
            const tokens = cssTokens(/^\s*--ease-([a-zA-Z0-9-]+):/gm)
            expect(tokens.length).toBeGreaterThan(1)
            const unmerged = tokens.filter((t) => twMerge(`ease-${t} ease-linear`) !== 'ease-linear')
            expect(unmerged).toEqual([])
        })
    })

    // a caller's animate-none could not cancel a component animation
    // (live site: InvitesIcon's animate-star-pulsate-wiggle).
    describe('custom animate tokens', () => {
        test('animate-none cancels a custom animation, both ways', () => {
            expect(twMerge('animate-pulsate animate-none')).toBe('animate-none')
            expect(twMerge('animate-none animate-pulsate')).toBe('animate-pulsate')
            expect(stockTwMerge('animate-pulsate animate-none')).toBe('animate-pulsate animate-none')
        })

        test('every --animate-* token in globals.css merges as an animation', () => {
            const tokens = cssTokens(/^\s*--animate-([a-zA-Z0-9-]+):/gm)
            expect(tokens.length).toBeGreaterThan(4)
            const unmerged = tokens.filter((t) => twMerge(`animate-${t} animate-none`) !== 'animate-none')
            expect(unmerged).toEqual([])
        })
    })

    // safe-area insets are on the spacing scale, so they must conflict with
    // stock spacing steps in every spacing-consuming group (pt, pb, mb, …).
    describe('safe-area spacing tokens', () => {
        test('a safe inset conflicts with a stock step on the same side only', () => {
            expect(twMerge('pt-safe-top pt-4')).toBe('pt-4')
            expect(twMerge('pt-4 pt-safe-top')).toBe('pt-safe-top')
            expect(twMerge('pb-safe-bottom pt-4')).toBe('pb-safe-bottom pt-4')
            expect(stockTwMerge('pt-safe-top pt-4')).toBe('pt-safe-top pt-4')
        })

        test('every --spacing-safe-* token in globals.css merges as spacing', () => {
            const tokens = cssTokens(/^\s*--spacing-(safe-[a-z]+):/gm)
            expect(tokens.length).toBe(4)
            const unmerged = tokens.filter((t) => twMerge(`p-${t} p-4`) !== 'p-4')
            expect(unmerged).toEqual([])
        })
    })

    // the brutalist offset shadows (.shadow-2, @utility shadow-4, the
    // primary/secondary scale) looked like unknown classes to stock
    // tailwind-merge, so shadow-none could not remove them.
    describe('custom shadow tokens', () => {
        test('custom shadows conflict with stock shadows and shadow-none', () => {
            expect(twMerge('shadow-4 shadow-none')).toBe('shadow-none')
            expect(twMerge('shadow-primary-4 shadow-lg')).toBe('shadow-lg')
            expect(twMerge('shadow-2 shadow-4')).toBe('shadow-4')
            // a shadow colour is a different channel and still composes
            expect(twMerge('shadow-red-500 shadow-4')).toBe('shadow-red-500 shadow-4')
            expect(stockTwMerge('shadow-4 shadow-none')).toBe('shadow-4 shadow-none')
        })

        test('every custom shadow-* class in globals.css merges as a shadow', () => {
            // the offset shadows are css classes/utilities, not @theme vars
            const tokens = cssTokens(/^\s*(?:\.|@utility )shadow-([a-zA-Z0-9-]+)\s*\{/gm)
            expect(tokens.length).toBeGreaterThan(6)
            const unmerged = tokens.filter((t) => twMerge(`shadow-${t} shadow-none`) !== 'shadow-none')
            expect(unmerged).toEqual([])
        })
    })

    // component classes with tailwind-shaped names: the colour groups ate them
    // (text-link lost to text-grey-1, bg-peanut-repeat-normal to bg-white).
    // each now owns its group, so colours compose instead of deleting them.
    describe('component classes with tailwind-shaped names', () => {
        test('a text colour no longer deletes text-link', () => {
            expect(twMerge('text-link text-grey-1')).toBe('text-link text-grey-1')
            expect(twMerge('text-link text-body-m')).toBe('text-link text-body-m')
            expect(stockTwMerge('text-link text-grey-1')).toBe('text-grey-1')
        })

        test('a text colour no longer deletes text-link-decoration', () => {
            expect(twMerge('text-link-decoration text-foreground-secondary')).toBe(
                'text-link-decoration text-foreground-secondary'
            )
            expect(stockTwMerge('text-link-decoration text-foreground-secondary')).toBe('text-foreground-secondary')
        })

        test('a border colour no longer deletes border-rounded', () => {
            expect(twMerge('border-rounded border-red-500')).toBe('border-rounded border-red-500')
            expect(stockTwMerge('border-rounded border-red-500')).toBe('border-red-500')
        })

        test('bg colours compose with the peanut patterns, which conflict among themselves', () => {
            expect(twMerge('bg-peanut-repeat-normal bg-white')).toBe('bg-peanut-repeat-normal bg-white')
            expect(twMerge('bg-peanut-repeat-normal bg-peanut-repeat-large')).toBe('bg-peanut-repeat-large')
            expect(stockTwMerge('bg-peanut-repeat-normal bg-white')).toBe('bg-white')
        })
    })
})
