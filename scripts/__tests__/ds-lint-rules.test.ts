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
