import {
    countOffScaleSpacing,
    countWeightStacks,
    countWeightStacksByRegex,
    countOffScaleRadius,
    OFF_SCALE_ICON_RE,
    RAW_DURATION_RE,
    RETYPED_CARD_RE,
    hasHoverWithoutActive,
    ARBITRARY_FONT_SIZE_RE,
    RAW_ERROR_TEXT_RE,
    hasHandRolledCloseGlyph,
} from '../ds-lint-rules.cjs'

const countMatches = (text: string, re: RegExp) => (text.match(re) ?? []).length

describe('offScaleSpacing', () => {
    it('flags off-scale steps across every spacing family, logical ps/pe/ms/me included', () => {
        for (const cls of ['p-5', 'px-7', 'py-2.5', 'gap-11', 'p-4.5', 'pr-18', 'ps-5', 'pe-18', 'ms-2.5', 'me-7']) {
            expect(countOffScaleSpacing(`<div className="${cls}" />`)).toBe(1)
        }
    })

    it('flags negative and variant-prefixed forms', () => {
        expect(countOffScaleSpacing('className="-m-2.5"')).toBe(1)
        expect(countOffScaleSpacing('className="-mt-5"')).toBe(1)
        expect(countOffScaleSpacing('className="md:pr-18"')).toBe(1)
        expect(countOffScaleSpacing('className="first:ps-7"')).toBe(1)
    })

    it('flags the 1px -px suffix on every family', () => {
        for (const cls of ['p-px', 'gap-px', '-m-px', 'md:pt-px']) {
            expect(countOffScaleSpacing(`<div className="${cls}" />`)).toBe(1)
        }
    })

    it('flags the logical block-axis families', () => {
        expect(countOffScaleSpacing('<div className="pbs-5 mbe-7" />')).toBe(2)
        expect(countOffScaleSpacing('<div className="-mbs-2.5 pbe-[3px]" />')).toBe(2)
        expect(countOffScaleSpacing('<div className="pbs-4 mbe-8" />')).toBe(0)
    })

    it('flags custom-property shorthand values', () => {
        for (const cls of ['p-(--gutter)', 'gap-(--space)', '-m-(--x)', 'md:ps-(--pad)']) {
            expect(countOffScaleSpacing(`<div className="${cls}" />`)).toBe(1)
        }
    })

    it('accepts every documented scale step, negatives and variants included', () => {
        for (const cls of [
            'p-0',
            'p-0.5',
            'gap-1',
            'px-2',
            'py-3',
            'p-4',
            'gap-6',
            'p-8',
            'mt-10',
            'pb-12',
            'ps-4',
            'me-2',
            '-mt-4',
            'md:gap-6',
            'space-y-8',
            'gap-x-16',
        ]) {
            expect(countOffScaleSpacing(`<div className="${cls}" />`)).toBe(0)
        }
    })

    it('flags arbitrary spacing values wholesale — the bracket form is always drift', () => {
        for (const cls of ['p-[5px]', 'gap-[20px]', 'p-[13px]', '-m-[3px]', 'md:ps-[10%]']) {
            expect(countOffScaleSpacing(`<div className="${cls}" />`)).toBe(1)
        }
    })

    it('does not misread longer utilities or words as spacing classes', () => {
        for (const text of [
            'className="max-p-5"',
            'theme-3',
            'frame-2',
            'className="w-[13px]"',
            'className="ms-auto"',
        ]) {
            expect(countOffScaleSpacing(text)).toBe(0)
        }
    })
})

describe('fontWeightOnTypeToken (countWeightStacks)', () => {
    it('counts a token and weight split across lines inside one className expression', () => {
        const jsx = [
            '<span',
            '    className={`text-body-m ${twMerge(',
            "        'font-semibold text-foreground-primary capitalize',",
            '        titleClassName',
            '    )}`}',
            '>',
        ].join('\n')
        expect(countWeightStacks(jsx)).toBe(1)
    })

    it('counts same-line stacks in plain strings and const class strings', () => {
        expect(countWeightStacks('<p className="text-body-s font-bold" />')).toBe(1)
        expect(countWeightStacks("const style = 'text-body-s font-bold underline'")).toBe(1)
    })

    it('counts every weight utility, not just the bold family', () => {
        for (const w of [
            'font-thin',
            'font-light',
            'font-normal',
            'font-medium',
            'font-black',
            'font-extraBlack',
            'font-[550]',
            'font-[650.5]',
            'font-(weight:--my-weight)',
            'font-[weight:var(--my-font-weight)]',
            // untyped custom property = font-weight in tailwind 4
            'font-(--my-weight)',
        ]) {
            expect(countWeightStacks(`<p className="text-body-s ${w}" />`)).toBe(1)
        }
        for (const notWeight of ['font-sans', 'font-roboto', 'font-(family-name:--brand-face)', 'font-blackout']) {
            expect(countWeightStacks(`<p className="text-body-s ${notWeight}" />`)).toBe(0)
        }
    })

    it('counts stacks carried through *ClassName props, not just className', () => {
        const jsx = [
            '<TitleBlock',
            "    titleClassName={twMerge('text-body-m',",
            "        'font-semibold')}",
            '/>',
        ].join('\n')
        expect(countWeightStacks(jsx)).toBe(1)
    })

    it('counts extracted multiline class builders assigned to variables', () => {
        const code = [
            'const classes = twMerge(',
            "    'text-body-m',",
            "    active && 'font-semibold'",
            ')',
            'return <p className={classes} />',
        ].join('\n')
        expect(countWeightStacks(code)).toBe(1)
    })

    it('counts multiline template-literal class constants outside builders', () => {
        const code = ['const classes = `text-body-m', '    font-semibold underline`', 'use(classes)'].join('\n')
        expect(countWeightStacks(code)).toBe(1)
    })

    // The forms the regex region-finders could not reach: a class list is only
    // visible to them when it is spelled as an attribute, a builder call or a
    // template literal. Rebuilding these in regex means writing a parser badly,
    // which is why the scanner parses now (scripts/ds-lint-ast.cjs).
    it('counts a class list assembled through array .join', () => {
        expect(countWeightStacks("const c = ['text-body-m', 'font-semibold'].join(' ')")).toBe(1)
        expect(countWeightStacks("const c = ['text-body-m', 'underline'].join(' ')")).toBe(0)
    })

    it('counts + concatenation, including split across lines', () => {
        expect(countWeightStacks("const c = 'text-body-m ' + 'font-semibold'")).toBe(1)
        expect(countWeightStacks(['const c =', "    'text-body-m ' +", "    'font-semibold'"].join('\n'))).toBe(1)
    })

    it('counts a lookup map of class strings, and resolves it at the use site', () => {
        expect(countWeightStacks("const SIZES = { sm: 'text-body-m font-semibold' }")).toBe(1)
        // Reached through the index too — and counted ONCE, because the drift is
        // the map entry, not each place it is read.
        const viaIndex = [
            "const SIZES = { sm: 'text-body-m font-semibold', lg: 'text-heading-s' }",
            'const c = SIZES[variant]',
            'const d = SIZES[other]',
        ].join('\n')
        expect(countWeightStacks(viaIndex)).toBe(1)
    })

    it('counts a token and a weight that only meet through a resolved const', () => {
        // Neither half is a stack on its own; the class list they compose is.
        const code = ["const TOKEN = 'text-body-m'", "const c = twMerge(TOKEN, 'font-semibold')"].join('\n')
        expect(countWeightStacks(code)).toBe(1)
    })

    it('counts a drifted constant once, however many places read it', () => {
        const code = [
            "const STYLE = 'text-body-m font-semibold'",
            'const El = () => (',
            '    <>',
            '        <p className={STYLE} />',
            '        <span className={STYLE} />',
            '    </>',
            ')',
        ].join('\n')
        expect(countWeightStacks(code)).toBe(1)
    })

    it('falls back to the regex scanner on source that does not parse', () => {
        // createSourceFile recovers rather than throwing, and a recovered tree
        // can be missing whole statements the source really has — so a dirty
        // parse must not be trusted, or the metric under-reports on exactly the
        // files it cannot read.
        const broken = ["const STYLE = 'text-body-m font-semibold'", '<p className={STYLE} />', '<span'].join('\n')
        expect(countWeightStacks(broken)).toBe(1)
    })

    it('does not read a variant map as a stack of its own siblings', () => {
        // One entry is selected at runtime, so two unrelated variants never
        // co-apply. Flattening the table invented the stack — and against a tight
        // baseline that fails CI on a perfectly good size map.
        const map = "const SIZES = { sm: 'text-body-m', lg: 'font-semibold' }"
        expect(countWeightStacks(`${map}; const c = SIZES[variant]`)).toBe(0)
        expect(countWeightStacks(`${map}; const c = SIZES.sm`)).toBe(0)
        // ...but a single entry that really does stack is still counted.
        expect(countWeightStacks("const SIZES = { sm: 'text-body-m font-semibold' }; const c = SIZES[v]")).toBe(1)
    })

    it('reads a static concatenation as the class list it actually renders', () => {
        // Only the two classes TOUCHING the join fuse, so no rule about the
        // boundary can decide this — the answer depends on the whole rendered
        // string. Folding the concatenation gets every shape right at once.

        // fully fused: one class, `text-body-mfont-semibold`, and no stack
        expect(countWeightStacks("const c = 'text-body-m' + 'font-semibold'")).toBe(0)
        // the stack sits wholly inside one operand; only `x`/`y` fuse
        expect(countWeightStacks("const c = 'text-body-m font-semibold x' + 'y'")).toBe(1)
        expect(countWeightStacks("const c = 'y' + 'x text-body-m font-semibold'")).toBe(1)
        // the fusion happens BETWEEN them, and both survive it as separate classes
        expect(countWeightStacks("const c = 'text-body-m x' + 'y font-semibold'")).toBe(1)
        // three-operand chains fold the same way, left to right
        expect(countWeightStacks("const c = 'text-body' + '-m x' + 'y font-semibold'")).toBe(1)
        expect(countWeightStacks("const c = 'text-body' + '-m' + 'font-semibold'")).toBe(0)
    })

    it('resolves an alias in the scope it was DECLARED in', () => {
        // `const alias = style` at module level means the MODULE's style, even
        // when read from a function that declares its own. Re-evaluating against
        // the use-site scopes picked the local namesake — wrong in both
        // directions.
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; const alias = style; function f(){ const style = 'underline'; return clsx(alias, 'font-semibold') }"
            )
        ).toBe(1)
        expect(
            countWeightStacks(
                "const style = 'underline'; const alias = style; function f(){ const style = 'text-body-m'; return clsx(alias, 'font-semibold') }"
            )
        ).toBe(0)
    })

    it('honours a braceless switch-case declaration', () => {
        // A CaseBlock holds CLAUSES, not statements, so `case x: const style = …`
        // declared into a scope the collector never read.
        expect(
            countWeightStacks(
                "const style='text-body-m'; function f(k){ switch(k){ case 1: const style='underline'; return clsx(style,'font-semibold') } }"
            )
        ).toBe(0)
    })

    it('hoists a var declared in a loop HEADER', () => {
        expect(
            countWeightStacks(
                "const style='text-body-m'; function f(xs){ for (var style of xs) {} return clsx(style,'font-semibold') }"
            )
        ).toBe(0)
        // a `const` loop binding does not leak past its loop
        expect(
            countWeightStacks(
                "const style='text-body-m'; function f(xs){ for (const y of xs) {} return clsx(style,'font-semibold') }"
            )
        ).toBe(1)
    })

    it('respects the token boundary across + concatenation', () => {
        // `+` GLUES: 'text-body-m' + 'font-semibold' renders the single class
        // `text-body-mfont-semibold`, not a token beside a weight.
        expect(countWeightStacks("const c = 'text-body-m' + 'font-semibold'")).toBe(0)
        expect(countWeightStacks("const c = 'text-body-m ' + 'font-semibold'")).toBe(1)
        expect(countWeightStacks("const c = 'text-body-m' + ' font-semibold'")).toBe(1)
        // an unreadable fragment is ASSUMED to separate — over-counting is the
        // safe direction for a debt ratchet
        expect(countWeightStacks("const c = 'text-body-m' + x + 'font-semibold'")).toBe(1)
    })

    it('resolves entries carried in by an object spread', () => {
        const base = "const BASE = { x: 'text-body-m' }; const S = { ...BASE }; "
        expect(countWeightStacks(`${base}const c = clsx(S[k], 'font-semibold')`)).toBe(1)
        expect(countWeightStacks(`${base}const c = clsx(S.x, 'font-semibold')`)).toBe(1)
    })

    it('hoists a nested var into its function scope', () => {
        // `var` is function-scoped, so a `var style` inside an `if` shadows for
        // the WHOLE function — including the call after the block closes.
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; function f(cond) { if (cond) { var style = 'underline' } return clsx(style, 'font-semibold') }"
            )
        ).toBe(0)
        // a nested FUNCTION's var does not leak outward
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; function f() { function g() { var style = 'u' } return clsx(style, 'font-semibold') }"
            )
        ).toBe(1)
    })

    it('combines a cva compound only with the options that select it', () => {
        const axes = "variants: { size: { sm: 'text-body-m', lg: 'underline' } }"
        // the compound fires for `lg`, whose class is not a type token — so its
        // weight never lands beside the `sm` token
        expect(
            countWeightStacks(
                `const c = cva('base', { ${axes}, compoundVariants: [{ size: 'lg', class: 'font-semibold' }] })`
            )
        ).toBe(0)
        // ...but for `sm` it really does co-apply
        expect(
            countWeightStacks(
                `const c = cva('base', { ${axes}, compoundVariants: [{ size: 'sm', class: 'font-semibold' }] })`
            )
        ).toBe(1)
        // and a compound whose own class stacks is caught regardless
        expect(
            countWeightStacks(
                "const c = cva('base', { variants: { size: { sm: 'x' } }, compoundVariants: [{ size: 'sm', class: 'text-body-m font-semibold' }] })"
            )
        ).toBe(1)
    })

    it('reads a clsx object as its KEYS, not its conditions', () => {
        // `clsx({ 'text-body-m': enabled, foo: 'font-semibold' })` renders
        // `text-body-m foo`. The value is a truthiness test; reading it as a
        // class stacked a weight that never reaches the element.
        expect(countWeightStacks("const c = clsx({ 'text-body-m': enabled, foo: 'font-semibold' })")).toBe(0)
        // both KEYS really do co-apply, so a stack across them still counts
        expect(countWeightStacks("const c = clsx({ 'text-body-m': a, 'font-semibold': b })")).toBe(1)
        // shorthand keys are classes too
        expect(countWeightStacks("const c = clsx({ 'text-body-m': a }, { 'font-semibold': b })")).toBe(1)
        // ...and a builder nested in a value is still analysed on its own
        expect(countWeightStacks("const c = clsx({ x: clsx('text-body-m', 'font-semibold') })")).toBe(1)
    })

    it('folds a const-backed operand into the rendered concatenation', () => {
        // The prefix really does render `text-body-m font-semibold`, two classes...
        expect(countWeightStacks("const prefix = 'text-body'; const c = clsx(prefix + '-m font-semibold')")).toBe(1)
        // ...and the mirror case renders ONE glued class, so it is not a stack
        expect(countWeightStacks("const token = 'text-body-m'; const c = clsx(token + 'font-semibold')")).toBe(0)
        // the const is read in ITS scope, not the use site's
        expect(
            countWeightStacks(
                "const prefix = 'text-body'; function f() { const prefix = 'underline'; return clsx(prefix + '-m font-semibold') }"
            )
        ).toBe(0)
        // ...and so is a const the const itself refers to: `prefix` is
        // module-level, so `base` has to resolve there too, not against the
        // function's namesake.
        expect(
            countWeightStacks(
                "const base = 'text-body'; const prefix = base; function f() { const base = 'underline'; return clsx(prefix + '-m font-semibold') }"
            )
        ).toBe(1)
        // a dynamic operand still falls back to the over-counting product
        expect(countWeightStacks("const c = clsx(unknown + 'text-body-m font-semibold')")).toBe(1)
    })

    it('reads a computed builder key as the class it renders', () => {
        expect(countWeightStacks("const c = clsx({ ['text-body-m']: a, ['font-semibold']: b })")).toBe(1)
        expect(countWeightStacks("const c = clsx({ ['text-body-m']: a, ['underline']: b })")).toBe(0)
        // and the same resolver selects by a computed key
        expect(
            countWeightStacks(
                "const S = { ['sm']: 'text-body-m', lg: 'underline' }; const c = clsx(S.sm, 'font-semibold')"
            )
        ).toBe(1)
    })

    it('renders nothing for an index a resolved array does not reach', () => {
        expect(countWeightStacks("const S = ['text-body-m']; const c = clsx(S[1], 'font-semibold')")).toBe(0)
        // a hole is just as absent
        expect(countWeightStacks("const S = ['text-body-m', , 'x']; const c = clsx(S[1], 'font-semibold')")).toBe(0)
        // an UNRESOLVED array still unions — absence has to be proven, and a
        // resolvable one whose index IS in range still selects
        expect(countWeightStacks("const S = ['underline', 'text-body-m']; const c = clsx(S[1], 'font-semibold')")).toBe(
            1
        )
    })

    it('reads cva config fields written as shorthand', () => {
        expect(
            countWeightStacks(
                "const variants = { tone: { loud: 'text-body-m' } }; const c = cva('base', { variants, compoundVariants: [{ tone: 'loud', class: 'font-semibold' }] })"
            )
        ).toBe(1)
        expect(
            countWeightStacks(
                "const variants = { tone: { loud: 'text-body-m' } }; const compoundVariants = [{ tone: 'loud', class: 'font-semibold' }]; const c = cva('base', { variants, compoundVariants })"
            )
        ).toBe(1)
    })

    it('folds a primitive operand instead of inventing a class boundary', () => {
        // `'a' + 1 + 'b'` is the single class `a1b` — refusing the number split
        // it into three and reported a stack nothing renders.
        expect(countWeightStacks("const c = clsx('text-body-m' + 1 + 'font-semibold')")).toBe(0)
        // ...and with real separators around it, both classes still land
        expect(countWeightStacks("const c = clsx('text-body-m ' + 1 + ' font-semibold')")).toBe(1)
        expect(countWeightStacks("const c = clsx('text-body-m' + true + 'font-semibold')")).toBe(0)
        // Every statically known primitive, or the ones left out reach the
        // dynamic product and invent the boundaries again.
        expect(countWeightStacks("const c = clsx('text-body-m' + undefined + 'font-semibold')")).toBe(0)
        expect(countWeightStacks("const c = clsx('text-body-m' + 1n + 'font-semibold')")).toBe(0)
        expect(countWeightStacks("const c = clsx('text-body-m' + -1 + 'font-semibold')")).toBe(0)
        // `undefined` is an ordinary identifier: a binding that shadows it has
        // a value we do not know, so the conservative product is right there
        expect(
            countWeightStacks("function f(undefined) { return clsx('text-body-m' + undefined + 'font-semibold') }")
        ).toBe(1)
        // ...and a real separator around one still leaves two classes
        expect(countWeightStacks("const c = clsx('text-body-m ' + -1 + ' font-semibold')")).toBe(1)
    })

    it('keeps an option a dynamic key could alias in a compound selection', () => {
        // `k === 'loud'` renders the second value, so committing the compound to
        // the spelled-out option reports a class list the selection can produce
        // a different one of.
        expect(
            countWeightStacks(
                "function f(k) { return cva('base', { variants: { tone: { loud: 'underline', [k]: 'text-body-m' } }, compoundVariants: [{ tone: 'loud', class: 'font-semibold' }] }) }"
            )
        ).toBe(1)
        // a READABLE sibling key changes nothing — the compound still selects
        expect(
            countWeightStacks(
                "const c = cva('base', { variants: { tone: { loud: 'underline', ['quiet']: 'text-body-m' } }, compoundVariants: [{ tone: 'loud', class: 'font-semibold' }] })"
            )
        ).toBe(0)
    })

    it('recomposes an unreadable cva spread under cva semantics', () => {
        // Each object the spread can be is a config in its own right, so its
        // variants and its compounds combine with each other — flattening it
        // into a bag of values reported neither together.
        expect(
            countWeightStacks(
                "const CONFIG = enabled ? { variants: { tone: { loud: 'text-body-m' } }, compoundVariants: [{ tone: 'loud', class: 'font-semibold' }] } : {}; const c = cva('base', { ...CONFIG })"
            )
        ).toBe(1)
        // one spread can hide SEVERAL axes, and those product rather than union
        expect(
            countWeightStacks(
                "const V = enabled ? { tone: { loud: 'text-body-m' }, emphasis: { bold: 'font-semibold' } } : {}; const c = cva('base', { variants: { ...V } })"
            )
        ).toBe(1)
        // an entry's `class` composes, so an array of classes is not alternatives
        expect(
            countWeightStacks(
                "const C = enabled ? { tone: 'loud', class: ['text-body-m', 'font-semibold'] } : {}; const c = cva('base', { variants: { tone: { loud: 'x' } }, compoundVariants: [{ ...C }] })"
            )
        ).toBe(1)
        // and a spread that resolves to NO object literal still falls back
        expect(
            countWeightStacks("const c = cva('base', { ...MAYBE, variants: { size: { sm: 'font-semibold' } } })")
        ).toBe(0)
    })

    it('reads an unreadable cva spread as config, not as a class builder', () => {
        // A config is nested tables whose leaves are the classes. Builder mode
        // reads an object's KEYS, so it returned `variants` and never descended
        // to anything that renders.
        expect(
            countWeightStacks(
                "const CONFIG = enabled ? { variants: { tone: { loud: 'text-body-m' } } } : {}; const c = cva('font-semibold', { ...CONFIG })"
            )
        ).toBe(1)
        // the same for an entry spread, whose `class` field is the leaf
        expect(
            countWeightStacks(
                "const C = enabled ? { tone: 'loud', class: 'font-semibold' } : {}; const c = cva('text-body-m', { variants: { tone: { loud: 'x' } }, compoundVariants: [{ ...C }] })"
            )
        ).toBe(1)
    })

    it('treats an unnamed axis as free for every compound', () => {
        // It has no name to PIN, but it is still selected independently, so a
        // compound pinned elsewhere renders beside whatever it carries.
        expect(
            countWeightStacks(
                "const TONE = enabled ? { tone: { loud: 'text-body-m' } } : {}; const c = cva('base', { variants: { ...TONE, size: { sm: 'x' } }, compoundVariants: [{ size: 'sm', class: 'font-semibold' }] })"
            )
        ).toBe(1)
    })

    it('keeps composing an axis table spread in from something unreadable', () => {
        // The spread may carry a `tone` axis; dropping it lost every class it
        // could have brought. Over-counting is the safe direction here.
        expect(
            countWeightStacks(
                "const TONE = enabled ? { tone: { loud: 'text-body-m' } } : {}; const c = cva('base', { variants: { ...TONE, size: { sm: 'font-semibold' } } })"
            )
        ).toBe(1)
        // an unreadable spread that could not carry a stack still reports none
        expect(
            countWeightStacks("const c = cva('base', { ...MAYBE, variants: { size: { sm: 'font-semibold' } } })")
        ).toBe(0)
    })

    it('falls back to the table when an opaque spread cut the search short', () => {
        // The definite `x` may still be sitting behind `...REST`, so the partial
        // list of dynamic candidates is not a complete answer.
        expect(
            countWeightStacks(
                "function f(k, j, REST) { const S = { x: 'underline', [k]: 'text-body-m', ...REST, [j]: 'underline' }; return clsx(S.x, 'font-semibold') }"
            )
        ).toBe(1)
    })

    it('evaluates a spread compound field in the scope it was written in', () => {
        expect(
            countWeightStacks(
                "const w = 'font-semibold'; const C = { tone: 'loud', class: w }; function f() { const w = 'underline'; return cva('base', { variants: { tone: { loud: 'text-body-m' } }, compoundVariants: [{ ...C }] }) }"
            )
        ).toBe(1)
        // and the reverse: the module value is the one that does NOT stack
        expect(
            countWeightStacks(
                "const w = 'underline'; const C = { tone: 'loud', class: w }; function f() { const w = 'font-semibold'; return cva('base', { variants: { tone: { loud: 'text-body-m' } }, compoundVariants: [{ ...C }] }) }"
            )
        ).toBe(0)
    })

    it('renders nothing for a key a resolved table does not have', () => {
        // `resolved` is what separates this from an unreadable table: unioning
        // here borrows a class from an entry the name can never reach.
        expect(countWeightStacks("const S = { sm: 'text-body-m' }; const c = clsx(S.lg, 'font-semibold')")).toBe(0)
        // an UNRESOLVED table still unions — absence has to be proven
        expect(countWeightStacks("function f(S) { return clsx(S.lg, 'font-semibold') }")).toBe(0)
        // ...and a table hiding an opaque spread cannot claim absence either
        expect(
            countWeightStacks(
                "function f(REST) { const S = { sm: 'text-body-m', ...REST }; return clsx(S.lg, 'font-semibold') }"
            )
        ).toBe(1)
    })

    it('looks past a non-matching spread to the definite property behind it', () => {
        // The known-empty spread must not end the search once a later dynamic
        // key has been collected — `f('y')` renders the earlier `x`.
        expect(
            countWeightStacks(
                "function f(k) { const EMPTY = {}; const S = { x: 'text-body-m', ...EMPTY, [k]: 'underline' }; return clsx(S.x, 'font-semibold') }"
            )
        ).toBe(1)
    })

    it('selects a numeric object key rather than unioning the map', () => {
        expect(
            countWeightStacks("const S = { 0: 'underline', 1: 'text-body-m' }; const c = clsx(S[0], 'font-semibold')")
        ).toBe(0)
        expect(
            countWeightStacks("const S = { 0: 'text-body-m', 1: 'underline' }; const c = clsx(S[0], 'font-semibold')")
        ).toBe(1)
        // the array path still works — it is tried after the object
        expect(countWeightStacks("const A = ['text-body-m', 'underline']; const c = clsx(A[0], 'font-semibold')")).toBe(
            1
        )
    })

    it('reads spread axes and honours the winning variants table', () => {
        expect(
            countWeightStacks(
                "const TONE = { tone: { loud: 'text-body-m' } }; const c = cva('base', { variants: { ...TONE, size: { sm: 'font-semibold' } } })"
            )
        ).toBe(1)
        // the explicit table wins over the spread, so the overridden classes are
        // not composed alongside the ones that actually render
        expect(
            countWeightStacks(
                "const CONFIG = { variants: { tone: { loud: 'font-semibold' } } }; const c = cva('base', { ...CONFIG, variants: { tone: { loud: 'text-body-m' } } })"
            )
        ).toBe(0)
        // ...and the winner is the LATER field, not the first one seen: here the
        // override is what carries the stack, so first-wins would report 0.
        expect(
            countWeightStacks(
                "const CONFIG = { variants: { tone: { loud: 'underline' } } }; const c = cva('font-semibold', { ...CONFIG, variants: { tone: { loud: 'text-body-m' } } })"
            )
        ).toBe(1)
    })

    it('expands a spread inside a cva compound entry', () => {
        expect(
            countWeightStacks(
                "const C = { tone: 'loud', class: 'font-semibold' }; const c = cva('base', { variants: { tone: { loud: 'text-body-m' } }, compoundVariants: [{ ...C }] })"
            )
        ).toBe(1)
        // and the entry's own field still overrides what the spread carried
        expect(
            countWeightStacks(
                "const C = { tone: 'loud', class: 'font-semibold' }; const c = cva('base', { variants: { tone: { loud: 'text-body-m', quiet: 'x' } }, compoundVariants: [{ ...C, tone: 'quiet' }] })"
            )
        ).toBe(0)
    })

    it('keeps body vars out of the parameter environment', () => {
        // A default initializer is evaluated before the body exists, so it reads
        // the OUTER binding; installing the body's hoisted vars for the whole
        // function shadowed it and lost the finding.
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; function f(x = clsx(style, 'font-semibold')) { var style = 'underline' }"
            )
        ).toBe(1)
        // inside the body the var really does shadow
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; function f(x) { var style = 'underline'; return clsx(style, 'font-semibold') }"
            )
        ).toBe(0)
    })

    it('folds a fully static template into the string it renders', () => {
        expect(countWeightStacks("const c = clsx(`${'text-body'}-m font-semibold`)")).toBe(1)
        // the mirror renders ONE glued class, so it is not a stack
        expect(countWeightStacks("const c = clsx(`${'text-body-m'}font-semibold`)")).toBe(0)
        // a dynamic span still classifies the pieces separately
        expect(countWeightStacks('const c = clsx(`text-body-m ${x} font-semibold`)')).toBe(1)
    })

    it('reads a const join separator', () => {
        expect(countWeightStacks("const sep = ' '; const c = ['text-body-m', 'font-semibold'].join(sep)")).toBe(1)
        // a non-whitespace one still yields a single class
        expect(countWeightStacks("const sep = ','; const c = ['text-body-m', 'font-semibold'].join(sep)")).toBe(0)
    })

    it('tells a shadowing binding apart from recursion', () => {
        // Two lexical bindings can share a name. Keying the cycle guard on the
        // SPELLING read `const outer = alias` as recursion and stopped the walk
        // before reaching the module value it really resolves to.
        expect(
            countWeightStacks(
                "const outer = 'text-body-m'; function f() { const alias = outer; function g() { const outer = alias; return clsx(outer, 'font-semibold') } }"
            )
        ).toBe(1)
        // a genuine cycle still terminates without inventing a value
        expect(countWeightStacks("const a = b; const b = a; const c = clsx(a, 'font-semibold')")).toBe(0)
    })

    it('leaves a class static block to own its vars', () => {
        // The hoist walk stops at a static block for the same reason it stops at
        // a nested function: the `var` is not the enclosing function's.
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; function f() { class C { static { var style = 'underline' } } return clsx(style, 'font-semibold') }"
            )
        ).toBe(1)
        // a var in the function's OWN body still shadows
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; function f() { var style = 'underline'; return clsx(style, 'font-semibold') }"
            )
        ).toBe(0)
    })

    it('reads a cva config spread, with explicit fields still winning', () => {
        const config =
            "const CONFIG = { variants: { tone: { loud: 'text-body-m' } }, compoundVariants: [{ tone: 'loud', class: 'font-semibold' }] }"
        expect(countWeightStacks(`${config}; const c = cva('base', { ...CONFIG })`)).toBe(1)
        // a property written alongside the spread overrides it, as at runtime
        expect(
            countWeightStacks(
                "const CONFIG = { variants: { tone: { loud: 'text-body-m' } } }; const c = cva('base', { ...CONFIG, variants: { tone: { loud: 'underline' } }, compoundVariants: [{ tone: 'loud', class: 'font-semibold' }] })"
            )
        ).toBe(0)
    })

    it('records a computed cva axis name so compounds can leave it free', () => {
        // The axis options reached the output either way; an unnamed axis was
        // invisible as a FREE axis, so a compound pinned elsewhere never
        // combined with it.
        expect(
            countWeightStacks(
                "const axis = 'tone'; const c = cva('base', { variants: { [axis]: { loud: 'text-body-m' }, size: { sm: 'y' } }, compoundVariants: [{ size: 'sm', class: 'font-semibold' }] })"
            )
        ).toBe(1)
    })

    it('combines overlapping compound selectors only on the options they share', () => {
        const axes = "variants: { tone: { loud: 'text-body-m', quiet: 'font-semibold', neutral: 'underline' } }"
        // They overlap only on `neutral`, where neither class is a stack —
        // taking each compound's whole selection paired loud with quiet.
        expect(
            countWeightStacks(
                `const c = cva('base', { ${axes}, compoundVariants: [{ tone: ['loud', 'neutral'], class: 'a' }, { tone: ['quiet', 'neutral'], class: 'b' }] })`
            )
        ).toBe(0)
        // ...and when the shared option IS the token, the pair still counts
        expect(
            countWeightStacks(
                "const c = cva('base', { variants: { tone: { loud: 'text-body-m', quiet: 'x' } }, compoundVariants: [{ tone: ['loud'], class: 'a' }, { tone: ['loud'], class: 'font-semibold' }] })"
            )
        ).toBe(1)
    })

    it('keeps a value a later dynamic key could alias', () => {
        // `f('x')` really renders the second value, so committing to the first
        // reports a class list the expression can produce a different one of.
        expect(
            countWeightStacks(
                "function f(k) { const S = { x: 'underline', [k]: 'text-body-m' }; return clsx(S.x, 'font-semibold') }"
            )
        ).toBe(1)
        // a READABLE computed key that is not the one asked for changes nothing
        expect(
            countWeightStacks(
                "function f() { const S = { x: 'underline', ['y']: 'text-body-m' }; return clsx(S.x, 'font-semibold') }"
            )
        ).toBe(0)
    })

    it('combines two cva compounds only when one selection fires both', () => {
        // Same axis, different options: no runtime selection matches both, so
        // producting them invents a stack across two variants of a valid table.
        expect(
            countWeightStacks(
                "const c = cva('base', { variants: { tone: { loud: 'x', quiet: 'y' } }, compoundVariants: [{ tone: 'loud', class: 'text-body-m' }, { tone: 'quiet', class: 'font-semibold' }] })"
            )
        ).toBe(0)
        // Different axes are selected independently, so both really do render.
        expect(
            countWeightStacks(
                "const c = cva('base', { variants: { tone: { loud: 'x' }, size: { sm: 'y' } }, compoundVariants: [{ tone: 'loud', class: 'text-body-m' }, { size: 'sm', class: 'font-semibold' }] })"
            )
        ).toBe(1)
        // Same axis with an option in COMMON: `tone: 'quiet'` fires both.
        expect(
            countWeightStacks(
                "const c = cva('base', { variants: { tone: { loud: 'x', quiet: 'y' } }, compoundVariants: [{ tone: ['loud', 'quiet'], class: 'text-body-m' }, { tone: 'quiet', class: 'font-semibold' }] })"
            )
        ).toBe(1)
        // and a single compound carrying both still counts on its own
        expect(
            countWeightStacks(
                "const c = cva('base', { variants: { tone: { loud: 'x' } }, compoundVariants: [{ tone: 'loud', class: 'text-body-m font-semibold' }] })"
            )
        ).toBe(1)
    })

    it('resolves a lookup key through a chain of consts', () => {
        const map = "const S = { sm: 'underline', lg: 'text-body-m' }"
        // `k` is `actual` is `'sm'` — the selected entry carries no type token
        expect(
            countWeightStacks(`const actual = 'sm'; const k = actual; ${map}; const c = clsx(S[k], 'font-semibold')`)
        ).toBe(0)
        expect(
            countWeightStacks(`const actual = 'lg'; const k = actual; ${map}; const c = clsx(S[k], 'font-semibold')`)
        ).toBe(1)
        // the chain is read in each binding's own scope
        expect(
            countWeightStacks(
                `const actual = 'sm'; const k = actual; ${map}; function f() { const actual = 'lg'; return clsx(S[k], 'font-semibold') }`
            )
        ).toBe(0)
        // a genuinely dynamic key still unions the whole table
        expect(countWeightStacks(`${map}; function f(k) { return clsx(S[k], 'font-semibold') }`)).toBe(1)
        // and a const-backed numeric index selects too
        expect(
            countWeightStacks(
                "const i = 1; const A = ['text-body-m', 'underline']; const c = clsx(A[i], 'font-semibold')"
            )
        ).toBe(0)
    })

    it('drops a cva compound whose selector can never match', () => {
        // cva tests an array selector with `includes`, so [] matches nothing.
        const axes = "variants: { tone: { loud: 'text-body-m', quiet: 'x' } }"
        expect(
            countWeightStacks(
                `const c = cva('base', { ${axes}, compoundVariants: [{ tone: [], class: 'font-semibold' }] })`
            )
        ).toBe(0)
        // field order must not matter — here the classes are read BEFORE the
        // selector, so the combination has to be dropped, not merely cut short
        expect(
            countWeightStacks(
                `const c = cva('base', { ${axes}, compoundVariants: [{ class: 'font-semibold', tone: [] }] })`
            )
        ).toBe(0)
        // ...and a non-empty one still fires
        expect(
            countWeightStacks(
                `const c = cva('base', { ${axes}, compoundVariants: [{ tone: ['loud'], class: 'font-semibold' }] })`
            )
        ).toBe(1)
    })

    it('treats an enum or namespace declaration as a real shadow', () => {
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; function f() { enum style { A }; return clsx(style, 'font-semibold') }"
            )
        ).toBe(0)
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; function f() { namespace style { export const a = 1 }; return clsx(style, 'font-semibold') }"
            )
        ).toBe(0)
        // Positive controls on the SAME shapes. A file that failed to parse falls
        // back to the regex counter, which also answers 0 here — so without these
        // the assertions above would be green on a broken parse.
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; function f() { enum other { A }; return clsx(style, 'font-semibold') }"
            )
        ).toBe(1)
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; function f() { namespace other { export const a = 1 }; return clsx(style, 'font-semibold') }"
            )
        ).toBe(1)
    })

    it('reads a shorthand entry as the value it binds', () => {
        expect(
            countWeightStacks("const sm = 'text-body-m'; const S = { sm }; const c = clsx(S[k], 'font-semibold')")
        ).toBe(1)
        // and through a direct, constant-key access
        expect(
            countWeightStacks("const sm = 'text-body-m'; const S = { sm }; const c = clsx(S.sm, 'font-semibold')")
        ).toBe(1)
        expect(
            countWeightStacks("const sm = 'underline'; const S = { sm }; const c = clsx(S.sm, 'font-semibold')")
        ).toBe(0)
        // A constant key SELECTS the shorthand entry rather than unioning the
        // table — otherwise `S.lg` borrows the token from its `sm` sibling.
        expect(
            countWeightStacks(
                "const sm = 'text-body-m'; const lg = 'underline'; const S = { sm, lg }; const c = clsx(S.lg, 'font-semibold')"
            )
        ).toBe(0)
        expect(
            countWeightStacks(
                "const sm = 'text-body-m'; const lg = 'underline'; const S = { sm, lg }; const c = clsx(S.sm, 'font-semibold')"
            )
        ).toBe(1)
    })

    it('selects a constant array index instead of unioning the array', () => {
        expect(countWeightStacks("const S = ['text-body-m', 'underline']; const c = clsx(S[1], 'font-semibold')")).toBe(
            0
        )
        expect(countWeightStacks("const S = ['text-body-m', 'underline']; const c = clsx(S[0], 'font-semibold')")).toBe(
            1
        )
        // an unknown index really can be any entry
        expect(countWeightStacks("const S = ['text-body-m', 'underline']; const c = clsx(S[i], 'font-semibold')")).toBe(
            1
        )
        // A spread at or before the index moves everything after it, so the
        // position is not knowable — fall back to the whole-array union, which
        // over-counts rather than reading the wrong entry. Index 1 here is
        // 'underline' only if REST has exactly one element.
        expect(
            countWeightStacks("const S = [...REST, 'underline', 'text-body-m']; const c = clsx(S[1], 'font-semibold')")
        ).toBe(1)
    })

    it('resolves an ARRAY cva compound selector to the options it names', () => {
        const axes = "variants: { tone: { loud: 'text-body-m', quiet: 'x' } }"
        // fires only for `quiet`, whose class carries no type token
        expect(
            countWeightStacks(
                `const c = cva('base', { ${axes}, compoundVariants: [{ tone: ['quiet'], class: 'font-semibold' }] })`
            )
        ).toBe(0)
        // ...but a list that includes `loud` does stack
        expect(
            countWeightStacks(
                `const c = cva('base', { ${axes}, compoundVariants: [{ tone: ['quiet', 'loud'], class: 'font-semibold' }] })`
            )
        ).toBe(1)
        // a selector we cannot read down to names leaves the axis unpinned
        expect(
            countWeightStacks(
                `const c = cva('base', { ${axes}, compoundVariants: [{ tone: someTone, class: 'font-semibold' }] })`
            )
        ).toBe(1)
    })

    it('keeps the axes a cva compound leaves unconstrained', () => {
        // `tone` is selected independently of `size`, so the compound's weight
        // really does render beside whatever tone was picked.
        const axes = "variants: { size: { sm: 'x', lg: 'y' }, tone: { loud: 'text-body-m' } }"
        expect(
            countWeightStacks(
                `const c = cva('base', { ${axes}, compoundVariants: [{ size: 'sm', class: 'font-semibold' }] })`
            )
        ).toBe(1)
        // the same axis PINNED to the option that carries the token still counts...
        expect(
            countWeightStacks(
                "const c = cva('base', { variants: { tone: { loud: 'text-body-m', quiet: 'y' } }, compoundVariants: [{ tone: 'loud', class: 'font-semibold' }] })"
            )
        ).toBe(1)
        // ...and pinned to the sibling still does not
        expect(
            countWeightStacks(
                "const c = cva('base', { variants: { tone: { loud: 'text-body-m', quiet: 'y' } }, compoundVariants: [{ tone: 'quiet', class: 'font-semibold' }] })"
            )
        ).toBe(0)
    })

    it('evaluates a table entry in the scope the table was declared in', () => {
        // MAP lives at module level, so `MAP.x` is the module's `style` even when
        // the read happens under a function that shadows the name.
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; const MAP = { x: style }; function f() { const style = 'underline'; return clsx(MAP.x, 'font-semibold') }"
            )
        ).toBe(1)
        expect(
            countWeightStacks(
                "const style = 'underline'; const MAP = { x: style }; function f() { const style = 'text-body-m'; return clsx(MAP.x, 'font-semibold') }"
            )
        ).toBe(0)
        // and the same through a cva compound's option table
        expect(
            countWeightStacks(
                "const opt = 'text-body-m'; const V = { tone: { loud: opt } }; function f() { const opt = 'underline'; return cva('base', { variants: V, compoundVariants: [{ tone: 'loud', class: 'font-semibold' }] }) }"
            )
        ).toBe(1)
        // ...and through a compoundVariants ARRAY hoisted out of the call
        expect(
            countWeightStacks(
                "const w = 'font-semibold'; const C = [{ tone: 'loud', class: w }]; function f() { const w = 'underline'; return cva('base', { variants: { tone: { loud: 'text-body-m' } }, compoundVariants: C }) }"
            )
        ).toBe(1)
    })

    it('only a WHITESPACE join composes a class list', () => {
        // `.join(',')` yields the single class `a,b`, and `.join()` defaults to a
        // comma — treating either as composition reports a stack no element ever
        // receives, and rejects valid non-class string assembly.
        const list = "const c = ['text-body-m', 'font-semibold']"
        expect(countWeightStacks(`${list}.join(' ')`)).toBe(1)
        expect(countWeightStacks(`${list}.join('\\n')`)).toBe(1)
        expect(countWeightStacks(`${list}.join(',')`)).toBe(0)
        expect(countWeightStacks(`${list}.join()`)).toBe(0)
        expect(countWeightStacks(`${list}.join(sep)`)).toBe(0)
    })

    it('the alternatives bound never drops a partial that can still form a match', () => {
        // A weight-only alternative sitting past the ceiling still forms a real
        // stack once the outer token products with it. Slicing it away reported
        // zero — a bound losing a finding, which is the one direction it must
        // never fail in.
        //
        // The weight goes FIRST on purpose. With it last, the incremental union
        // rebuilds after the cap and happens to keep it — so a weight-last
        // fixture passes even with the bound broken, and proves nothing.
        const many = Array.from({ length: 300 }, (_, i) => `'text-body-m-${i}'`).join(', ')
        expect(countWeightStacks(`const S = ['font-semibold', ${many}]; const c = clsx('text-body-m', S[i])`)).toBe(1)
    })

    it('treats an INDEXED array as alternatives, and a joined one as one list', () => {
        // Producting every array invented a stack across two entries of a valid
        // variant list; the regex scanner reported 0 for the indexed form.
        const list = "const S = ['text-body-m', 'font-semibold']"
        expect(countWeightStacks(`${list}; const c = clsx(S[i])`)).toBe(0)
        expect(countWeightStacks(list)).toBe(0)
        // ...but `.join(' ')` renders every entry into ONE class list.
        expect(countWeightStacks("const c = ['text-body-m', 'font-semibold'].join(' ')")).toBe(1)
    })

    it('unions cva options within an axis and combines across axes', () => {
        // One option per axis is rendered, so two options of the SAME axis never
        // co-apply — but two AXES are selected independently and both land.
        expect(
            countWeightStacks(
                "const c = cva('base', { variants: { size: { sm: 'text-body-m', lg: 'font-semibold' } } })"
            )
        ).toBe(0)
        expect(
            countWeightStacks(
                "const c = cva('base', { variants: { size: { sm: 'text-body-m' }, w: { b: 'font-semibold' } } })"
            )
        ).toBe(1)
        // the base co-applies with every axis
        expect(countWeightStacks("const c = cva('text-body-m', { variants: { w: { b: 'font-semibold' } } })")).toBe(1)
    })

    it('honours every shadowing form, not just parameters', () => {
        // A shadow the scanner does not RECORD is a shadow it silently ignores:
        // the name falls through to an unrelated outer const.
        const outer = "const style = 'text-body-m'; "
        expect(
            countWeightStacks(
                `${outer}function f(props) { const { style } = props; return clsx(style, 'font-semibold') }`
            )
        ).toBe(0)
        expect(
            countWeightStacks(
                `${outer}function f(xs) { for (const style of xs) { use(clsx(style, 'font-semibold')) } }`
            )
        ).toBe(0)
        expect(
            countWeightStacks(
                `${outer}function f() { try { g() } catch (style) { return clsx(style, 'font-semibold') } }`
            )
        ).toBe(0)
        expect(countWeightStacks(`${outer}const f = function style() { return clsx(style, 'font-semibold') }`)).toBe(0)
        // the genuine outer-const stack is still counted
        expect(countWeightStacks(`${outer}const c = clsx(style, 'font-semibold')`)).toBe(1)
    })

    it('reads class strings written as builder object KEYS', () => {
        // `clsx({ 'a b': cond })` puts the classes in the key. Treating every
        // object as a lookup map lost this form entirely — the old regex counter
        // caught it, so it was a coverage regression rather than a refinement.
        expect(countWeightStacks("const c = clsx({ 'text-body-m font-semibold': enabled })")).toBe(1)
        expect(countWeightStacks("const c = clsx({ 'text-body-m': a, 'font-semibold': b })")).toBe(1)
        expect(countWeightStacks("const c = clsx({ 'text-body-m': a, 'underline': b })")).toBe(0)
    })

    it('lets independently selectable cva axes combine', () => {
        // Two axes are chosen separately and applied together, so a token in one
        // and a weight in the other really can land on the same element.
        expect(
            countWeightStacks(
                "const c = cva('base', { variants: { size: { sm: 'text-body-m' }, weight: { b: 'font-semibold' } } })"
            )
        ).toBe(1)
    })

    it('still treats an INDEXED map as alternatives, even inside a builder', () => {
        // Indexing selects one entry: `clsx(SIZES[variant])` picks a variant, it
        // does not apply the whole table.
        const map = "const S = { sm: 'text-body-m', lg: 'font-semibold' }"
        expect(countWeightStacks(`${map}; const c = clsx(S[v])`)).toBe(0)
        expect(countWeightStacks(`${map}; const c = clsx(S.sm)`)).toBe(0)
        expect(countWeightStacks(`${map}; const c = S[v]`)).toBe(0)
    })

    it('does not stack two overflow variants against each other', () => {
        // Merging overflow into one list recreated the very cross-variant stack
        // the alternatives model exists to prevent, just past the ceiling.
        const clean = Array.from({ length: 64 }, (_, i) => `    k${i}: 'text-body-m',`).join('\n')
        expect(countWeightStacks(`const S = {\n${clean}\n    a: 'text-body-m',\n    b: 'font-semibold',\n}`)).toBe(0)
    })

    it('does not truncate a late map entry into invisibility', () => {
        // Bounding by PIECES meant a real stack far enough down the object was
        // sliced off and reported zero. The bound is on distinct summaries now,
        // and keeps matches first, so it can cost precision but never a finding.
        const big = Array.from({ length: 600 }, (_, i) => `    k${i}: 'text-body-m',`).join('\n')
        expect(countWeightStacks(`const S = {\n${big}\n    late: 'text-body-m font-semibold',\n}`)).toBe(1)
    })

    it('lets a parameter shadow an outer const', () => {
        // A binding merely ABSENT from the scope map falls through to an outer
        // scope, so a parameter named `style` resolved to an unrelated
        // module-level const and reported a stack the parameter never carries.
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; function clean(style) { return clsx(style, 'font-semibold') }"
            )
        ).toBe(0)
        // arrow params and destructured params shadow too
        expect(
            countWeightStacks("const style = 'text-body-m'; const f = (style) => clsx(style, 'font-semibold')")
        ).toBe(0)
        expect(
            countWeightStacks("const style = 'text-body-m'; const f = ({ style }) => clsx(style, 'font-semibold')")
        ).toBe(0)
        // ...and an inner `let` shadows without being inlined
        expect(
            countWeightStacks(
                "const style = 'text-body-m'; function f() { let style = 'x'; return clsx(style, 'font-semibold') }"
            )
        ).toBe(0)
        // the genuine outer-const stack is still counted
        expect(countWeightStacks("const style = 'text-body-m'; const c = clsx(style, 'font-semibold')")).toBe(1)
    })

    it('still sees drift in a map entry past the alternatives ceiling', () => {
        // Returning early at the cap was a false NEGATIVE with teeth: 64 clean
        // entries followed by a drifted one walked past the ratchet entirely.
        // Overflow is merged instead, which can only over-count — the one
        // direction a debt ratchet is allowed to be wrong in.
        const clean = Array.from({ length: 64 }, (_, i) => `    k${i}: 'text-body-m',`).join('\n')
        expect(countWeightStacks(`const SIZES = {\n${clean}\n    late: 'text-body-m font-semibold',\n}`)).toBe(1)

        // ...and a large map that is genuinely clean stays clean.
        const allClean = Array.from({ length: 80 }, (_, i) => `    k${i}: 'text-body-m',`).join('\n')
        expect(countWeightStacks(`const SIZES = {\n${allClean}\n}`)).toBe(0)
    })

    it('resolves an identifier to its own scope, not to a later namesake', () => {
        // A file-wide name→initializer map let a later declaration in an
        // unrelated function overwrite an earlier one, which hid real stacks or
        // invented fake ones depending purely on source order.
        const aThenB = [
            'function A() {',
            "    const style = 'text-body-m'",
            "    return clsx(style, 'font-semibold')",
            '}',
            'function B() {',
            "    const style = 'underline'",
            '    return style',
            '}',
        ].join('\n')
        expect(countWeightStacks(aThenB)).toBe(1)

        // Reversed: B is clean and must stay clean.
        const bThenA = [
            'function B() {',
            "    const style = 'underline'",
            "    return clsx(style, 'font-semibold')",
            '}',
            'function A() {',
            "    const style = 'text-body-m'",
            '    return style',
            '}',
        ].join('\n')
        expect(countWeightStacks(bThenA)).toBe(0)
    })

    it('does not inline a mutable binding', () => {
        // `let`/`var` can be reassigned after the declaration the scanner reads,
        // so the class list it would report may never exist.
        expect(
            countWeightStacks("let style = 'text-body-m'; style = 'x'; const c = clsx(style, 'font-semibold')")
        ).toBe(0)
        expect(countWeightStacks("var style = 'text-body-m'; const c = clsx(style, 'font-semibold')")).toBe(0)
        // the const equivalent still counts
        expect(countWeightStacks("const style = 'text-body-m'; const c = clsx(style, 'font-semibold')")).toBe(1)
    })

    it('does not count a token and a weight that only meet in prose', () => {
        // The per-line residue pass had no way to tell source from commentary,
        // so a comment ABOUT the drift counted as the drift (0_Bruddle/Section.tsx).
        expect(countWeightStacks('// font-bold vs text-heading-card drift')).toBe(0)
        expect(countWeightStacks('/* prefer text-body-m + font-semibold */')).toBe(0)
    })

    it('survives a file it cannot parse rather than reporting zero', () => {
        // A metric that returns 0 on an unreadable file is a ratchet with the
        // tension let out. The regex scanner is the floor.
        expect(countWeightStacksByRegex('<p className="text-body-s font-bold" />')).toBe(1)
    })

    it('does not count a token and a weight living in different elements', () => {
        const jsx = [
            '<p className="text-body-m">a</p>',
            '<p className="font-semibold">b</p>',
            '<p className={twMerge("text-label-l", cls)}>c</p>',
        ].join('\n')
        expect(countWeightStacks(jsx)).toBe(0)
    })
})

describe('iconOffScale', () => {
    it('flags off-step size, width/height props, and class-sized Icons', () => {
        for (const text of [
            '<Icon name="info" size={18} />',
            '<Icon name={logo} width={18} height={18} />',
            '<Icon name="swap" width={32} height={32} />',
            'iconSize={13}',
            '<Icon name="check" className="size-4" />',
            '<Icon name="paste" className="h-3.5 w-3.5" />',
            '<Icon name="chevron-up" className={`h-4 w-4 transition-transform ${open ? "" : "rotate-180"}`} />',
            "<Icon name={icon} className={twMerge('size-6', extra)} />",
            '<Icon name="x" className="size-[18px]" />',
            '<Icon name="x" className="size-(--icon)" />',
            "<Icon name={icon} className={twMerge('h-[18px] w-[18px]', extra)} />",
            '<Icon name="x" size={iconSize} />',
            '<Icon name="x" size={small ? 16 : 20} />',
            'iconSize={resolved}',
            '<Icon name="x" size="18" />',
            'iconSize="18"',
            'iconSize="2"',
            'iconSize="8"',
        ]) {
            expect(countMatches(text, OFF_SCALE_ICON_RE)).toBeGreaterThan(0)
        }
    })

    it('accepts the 16/20/24 steps', () => {
        for (const text of [
            '<Icon name="info" size={16} />',
            '<Icon size={20} />',
            '<Icon size={24} />',
            'iconSize={20}',
            '<Icon name="x" size="16" />',
            'iconSize="4"',
            'iconSize="6"',
            'iconSize="24"',
        ]) {
            expect(countMatches(text, OFF_SCALE_ICON_RE)).toBe(0)
        }
    })
})

describe('offScaleRadius (countOffScaleRadius)', () => {
    it('flags radii off the scale — named steps, sides, and arbitrary values', () => {
        for (const cls of [
            'rounded-md',
            'rounded-lg',
            'rounded-t-2xl',
            'rounded-3xl',
            'rounded-[1px]',
            'rounded-[5px]',
            'rounded-t-[10px]',
            'rounded-xs',
        ]) {
            expect(countOffScaleRadius(`className="${cls}"`)).toBe(1)
        }
    })

    it('accepts the scale classes, bare rounded and sides included', () => {
        for (const cls of [
            'rounded-sm',
            'rounded-round',
            'rounded-full',
            'rounded-none',
            'rounded',
            'rounded-t-sm',
            'rounded-e-full',
        ]) {
            expect(countOffScaleRadius(`className="${cls}"`)).toBe(0)
        }
    })
})

describe('rawDuration', () => {
    it('flags any numeric or arbitrary duration', () => {
        for (const cls of ['duration-100', 'duration-250', 'duration-75', 'duration-[250ms]', 'duration-(--speed)']) {
            expect(countMatches(`className="${cls}"`, RAW_DURATION_RE)).toBe(1)
        }
    })

    it('accepts the motion tokens', () => {
        for (const cls of ['duration-instant', 'duration-fast', 'duration-moderate', 'duration-slow']) {
            expect(countMatches(`className="${cls}"`, RAW_DURATION_RE)).toBe(0)
        }
    })
})

describe('retypedCardLiteral', () => {
    it('flags the Global/Card chrome respelled as a literal', () => {
        expect(
            countMatches(
                'className="rounded-sm border border-border-default bg-background-default p-4"',
                RETYPED_CARD_RE
            )
        ).toBe(1)
    })

    it('accepts the classes apart', () => {
        expect(countMatches('className="rounded-sm border border-border-default"', RETYPED_CARD_RE)).toBe(0)
    })
})

describe('hoverNoActiveFiles', () => {
    it('flags a file with hover styling and no pressed state', () => {
        expect(hasHoverWithoutActive('className="hover:bg-action-primary"')).toBe(true)
    })

    it('accepts a file that pairs hover with active', () => {
        expect(hasHoverWithoutActive('className="hover:bg-action-primary active:bg-action-primary"')).toBe(false)
    })
})

describe('arbitraryFontSize', () => {
    it('flags arbitrary font sizes', () => {
        for (const cls of ['text-[13px]', 'text-[1.4rem]', 'text-[11px]']) {
            expect(countMatches(`className="${cls}"`, ARBITRARY_FONT_SIZE_RE)).toBe(1)
        }
    })

    it('accepts type tokens and arbitrary colors', () => {
        for (const cls of ['text-body-m', 'text-[#ffffff]', 'text-[color:var(--x)]']) {
            expect(countMatches(`className="${cls}"`, ARBITRARY_FONT_SIZE_RE)).toBe(0)
        }
    })
})

describe('rawErrorText', () => {
    it('flags raw error-colored text', () => {
        expect(countMatches('className="text-body-s text-foreground-error"', RAW_ERROR_TEXT_RE)).toBe(1)
    })

    it('leaves border-error and badge tokens alone', () => {
        expect(countMatches('className="border-border-error bg-background-badge-error"', RAW_ERROR_TEXT_RE)).toBe(0)
    })
})

describe('handRolledCloseGlyphFiles', () => {
    it('flags a file pairing <button with a cancel icon', () => {
        expect(hasHandRolledCloseGlyph('<button onClick={onClose}><Icon name="cancel" size={20} /></button>')).toBe(
            true
        )
    })

    it('accepts DS Button closes', () => {
        expect(hasHandRolledCloseGlyph('<Button shape="square"><Icon name="cancel" size={20} /></Button>')).toBe(false)
    })
})
