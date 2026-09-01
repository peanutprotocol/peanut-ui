import {
    countOffScaleSpacing,
    countWeightStacks,
    countOffScaleRadius,
    OFF_SCALE_ICON_RE,
    RAW_DURATION_RE,
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
        ]) {
            expect(countWeightStacks(`<p className="text-body-s ${w}" />`)).toBe(1)
        }
        for (const notWeight of ['font-sans', 'font-roboto', 'font-(--brand-face)', 'font-blackout']) {
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
