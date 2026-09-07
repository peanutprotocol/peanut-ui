import ts from 'typescript'
import classNames from 'classnames'
import { spawnSync } from 'node:child_process'
import { countWeightStacks } from '../ds-lint-rules.cjs'
import cvaCases from './fixtures/ds-lint-cva-review-cases.json'

// Include cold TypeScript startup on busy CI workers. The result must still be
// the explicit diagnostic, never a timeout, OOM, or a numeric fallback.
const CHILD_TIMEOUT = 15000

type Expression = { expression: string; declarations: string[] }
type Wrapper = [string, (expression: string, stage: number) => string]
const wrappers: Wrapper[] = [
    ['identity', (x) => x],
    ['parentheses', (x) => `(${x})`],
    ['as assertion', (x) => `(${x} as unknown)`],
    ['angle assertion', (x) => `(<unknown>(${x}))`],
    ['satisfies', (x) => `(${x} satisfies unknown)`],
    ['non-null', (x) => `(${x})!`],
    ['const alias', (x) => x],
    ['object selection', (x) => `({x:${x}}).x`],
    ['array selection', (x) => `[${x}][0]`],
    ['string array index', (x) => `[${x}]['0']`],
    ['object spread', (x) => `({...{x:${x}}}).x`],
    ['array spread', (x) => `[...['underline'],${x}][1]`],
    ['conditional object', (x, i) => `(flag${i + 1}?{x:${x}}:{x:'underline'}).x`],
    ['conditional array', (x, i) => `(flag${i + 1}?[${x}]:['underline'])[0]`],
    ['conditional missing property', (x, i) => `(flag${i + 1}?{x:${x}}:{}).missing`],
    ['conditional invalid index', (x, i) => `(flag${i + 1}?[${x}]:[])[-1]`],
    ['static ternary', (x) => `(false?${x}:'underline')`],
    ['unknown ternary', (x, i) => `(flag${i + 1}?${x}:'underline')`],
    ['unknown and', (x, i) => `(flag${i + 1}&&${x})`],
    ['true and', (x) => `(true&&${x})`],
    ['false and', (x) => `(false&&${x})`],
    ['truthy object or', (x) => `({x:${x}}||{x:'underline'}).x`],
    ['non-null object coalescing', (x) => `({x:${x}}??{x:'underline'}).x`],
    ['null coalescing', (x) => `(null??{x:${x}}).x`],
    ['later field wins', (x) => `({...{x:${x}},x:'underline'}).x`],
    ['static false spread', (x) => `({x:'underline',...(false&&{x:${x}})}).x`],
    ['conditional spread', (x, i) => `({x:'underline',...(flag${i + 1}&&{x:${x}})}).x`],
    ['computed property', (x, i) => `({[flag${i + 1}?'x':'other']:${x}}).x`],
]
const seeds = [
    { name: 'token', expression: "'text-body-m'", weight: true },
    { name: 'clean', expression: "'underline'", weight: true },
    { name: 'conditional token', expression: "flag0?'text-body-m':'underline'", weight: true },
    { name: 'exclusive classes', expression: "flag0?'text-body-m':'font-semibold'", weight: false },
    { name: 'class array', expression: "['text-body-m','font-semibold']", weight: false },
    { name: 'builder object', expression: "{'text-body-m':flag0,'font-semibold':true}", weight: false },
]
function wrap(input: Expression, wrapper: Wrapper, stage: number): Expression {
    if (wrapper[0] === 'const alias')
        return {
            expression: `alias${stage}`,
            declarations: [...input.declarations, `const alias${stage}=(${input.expression});`],
        }
    return { ...input, expression: wrapper[1](`(${input.expression})`, stage) }
}
const flags = Array.from({ length: 8 }, (_, i) => [Boolean(i & 1), Boolean(i & 2), Boolean(i & 4)])
function runtimeExists(source: string): boolean {
    // Only generated closed fixtures are executed. Application source is never
    // evaluated by the scanner or by this oracle.
    const js = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
        fileName: 'fixture.ts',
    }).outputText
    const fixture = new Function('classNames', `${js};return fixture`)(classNames)
    return flags
        .map((values) => {
            const result = fixture(...values) as string
            const tokens = result.split(/\s+/)
            return tokens.includes('text-body-m') && tokens.includes('font-semibold')
        })
        .some(Boolean)
}

describe('generated class-expression semantics', () => {
    // Every pair of wrappers is applied to every seed: 28 * 28 * 6 = 4704
    // programs, each checked across all eight assignments of three booleans.
    it.each(wrappers)(
        'composes %s with every other wrapper',
        (name, outer) => {
            const errors: unknown[] = []
            for (const inner of wrappers)
                for (const seed of seeds) {
                    const wrapped = wrap(
                        wrap({ expression: seed.expression, declarations: [] }, inner, 0),
                        [name, outer],
                        1
                    )
                    const source = `function fixture(flag0,flag1,flag2){${wrapped.declarations.join('\n')}return classNames(${wrapped.expression}${seed.weight ? ",'font-semibold'" : ''})}`
                    const expected = runtimeExists(source)
                    try {
                        const actual = countWeightStacks(source, 'fixture.ts') > 0
                        if (actual !== expected)
                            errors.push({ inner: inner[0], seed: seed.name, expected, actual, source })
                    } catch (error) {
                        errors.push({ inner: inner[0], seed: seed.name, error: String(error), source })
                    }
                }
            expect(errors).toEqual([])
        },
        30000
    )

    it.each([
        "const S={2:'text-body-m',11:'underline'};return classNames(S[1+1],'font-semibold')",
        "const S={2:'text-body-m',11:'underline'};return classNames(S[3-1],'font-semibold')",
        "const S={2:'text-body-m',11:'underline'};return classNames(S[4/2],'font-semibold')",
        "const S={2:'text-body-m',11:'underline'};return classNames(S[1n+1n],'font-semibold')",
        "return classNames({'text-body-m':false,'font-semibold':true})",
        "return classNames({'text-body-m':true,...{'text-body-m':false},'font-semibold':true})",
        "return classNames({'text-body-m':true,...(true&&{'text-body-m':false}),'font-semibold':true})",
        "return classNames({'text-body-m':false,...(false&&{'text-body-m':true}),'font-semibold':true})",
        "return classNames(({}.missing?'text-body-m':'underline'),'font-semibold')",
        "return classNames(([].length?'text-body-m':'underline'),'font-semibold')",
        "return classNames({...['text-body-m']},'font-semibold')",
        "return classNames(({...['text-body-m']})[0],'font-semibold')",
        "return classNames({...('text-body-m')},'font-semibold')",
        "return classNames([...('text-body-m')][0],'font-semibold')",
        "return classNames(('underline'+(flag0?'a':'b'))||'text-body-m','font-semibold')",
        "return classNames(!{}?'text-body-m':'underline','font-semibold')",
        "return classNames(![]?'text-body-m':'underline','font-semibold')",
        "const S={'-Infinity':'text-body-m',Infinity:'underline'};return classNames(S[1/(flag0?0:-0)],'font-semibold')",
    ])('matches primitive/override behavior: %s', (body) => {
        const source = `function fixture(flag0,flag1,flag2){${body}}`
        expect(countWeightStacks(source, 'fixture.ts') > 0).toBe(runtimeExists(source))
    })
})

describe('explicit unsupported CVA boundary', () => {
    it.each(cvaCases)('rejects historical review fixture: $title', ({ source }) => {
        expect(() => countWeightStacks(source)).toThrow('UNSUPPORTED_CVA')
    })
    it.each([
        "import {cva as recipe} from 'class-variance-authority';recipe('base')",
        "import * as recipes from 'class-variance-authority';recipes.cva('base')",
        "cva('font-semibold',{variants:{tone:{loud:'underline'}},...(false&&{variants:{tone:{loud:'text-body-m'}}})})",
        "cva('font-semibold',{variants:{tone:{loud:'text-body-m'}},...(true&&{variants:{tone:{loud:'underline'}}})})",
    ])('rejects CVA before claiming a numeric result: %s', (source) => {
        expect(() => countWeightStacks(source)).toThrow('UNSUPPORTED_CVA')
    })
    it('does not expand hypothetical CVA configurations', () => {
        const fields = Array.from({ length: 24 }, (_, i) => `[k${i}]:{}`).join(',')
        const result = spawnSync(
            process.execPath,
            [
                '--max-old-space-size=128',
                '-e',
                'try{require(process.argv[1]).countWeightStacks(process.argv[2])}catch(e){console.log(e.code)}',
                require.resolve('../ds-lint-rules.cjs'),
                `cva('base',{${fields}})`,
            ],
            { encoding: 'utf8', timeout: CHILD_TIMEOUT }
        )
        expect(result.error).toBeUndefined()
        expect(result.status).toBe(0)
        expect(result.stdout.trim()).toBe('UNSUPPORTED_CVA')
    })
})

describe('bounded analysis failures', () => {
    it.each(['objects', 'arrays'])('reports a %s expansion limit before returning a clean count', (kind) => {
        const branches = Array.from({ length: 16 }, (_, i) =>
            kind === 'objects' ? `...(flag${i}?{x:'text-body-m'}:{})` : `...(flag${i}?['text-body-m']:[])`
        ).join(',')
        const value = kind === 'objects' ? `{${branches}}` : `[${branches}]`
        const source = `classNames(${value},'font-semibold')`
        const result = spawnSync(
            process.execPath,
            [
                '--max-old-space-size=128',
                '-e',
                'try{console.log(require(process.argv[1]).countWeightStacks(process.argv[2]))}catch(e){console.error(e.code);process.exitCode=1}',
                require.resolve('../ds-lint-rules.cjs'),
                source,
            ],
            { encoding: 'utf8', timeout: CHILD_TIMEOUT }
        )
        expect(result.error).toBeUndefined()
        expect(result.status).toBe(1)
        expect(result.stderr.trim()).toBe('ANALYSIS_LIMIT')
        expect(result.stdout.trim()).toBe('')
    })
    it('reports a finite alias chain beyond the depth budget', () => {
        const aliases = Array.from({ length: 300 }, (_, i) => `const a${i + 1}=a${i};`).join('')
        expect(() => countWeightStacks(`const a0='text-body-m';${aliases}classNames(a300,'font-semibold')`)).toThrow(
            'ANALYSIS_LIMIT'
        )
    })
    it('bounds generated text before concatenating large operands', () => {
        const long = 'a'.repeat(40000)
        expect(() => countWeightStacks(`classNames('${long}'+'${long}')`)).toThrow('ANALYSIS_LIMIT')
    })
    it('terminates alias cycles and retains a reachable alternate', () => {
        expect(countWeightStacks("const a=b;const b=a;classNames(a,'font-semibold')")).toBe(0)
        expect(countWeightStacks("const a=flag?a:'text-body-m';classNames(a,'font-semibold')")).toBe(1)
    })
})
