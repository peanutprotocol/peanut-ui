import ts from 'typescript'
import classNames from 'classnames'
import { countWeightStacks } from '../ds-lint-rules.cjs'

function expectRuntimeAgreement(body: string) {
    // Execute only these closed regression fixtures, never application source.
    const source = `function fixture(flag){${body}}`
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
    const fixture = new Function('classNames', `${js};return fixture`)(classNames)
    const expected = [false, true].some((flag) => {
        const classes = fixture(flag).split(/\s+/)
        return classes.includes('text-body-m') && classes.includes('font-semibold')
    })
    expect(countWeightStacks(source, 'fixture.ts') > 0).toBe(expected)
}

describe('review boundary runtime regressions', () => {
    it.each([
        '{}',
        '[]',
        'function(){}',
        '()=>0',
        'class {}',
        '/x/',
        'new Object()',
        'new Boolean(false)',
        'new (function(){return 0})()',
        'flag ? class {} : /x/',
        '({value: class {}}).value',
    ])('uses object truthiness in every guard context: %s', (guard) => {
        for (const expression of [
            `(${guard}) ? 'underline' : 'text-body-m'`,
            `!(${guard}) ? 'text-body-m' : 'underline'`,
            `(${guard}) && 'text-body-m'`,
            `(${guard}) || 'text-body-m'`,
            `(${guard}) ?? 'text-body-m'`,
        ])
            expectRuntimeAgreement(`return classNames((${expression}), 'font-semibold')`)
        expectRuntimeAgreement(
            `const guard=(${guard});return classNames(guard?'underline':'text-body-m','font-semibold')`
        )
    })

    it.each([
        "if(flag){var style='underline'} result=classNames(style,'font-semibold')",
        "result=classNames(style,'font-semibold'); if(flag){var style='underline'}",
        "for(var style of []){} result=classNames(style,'font-semibold')",
        "if(flag){var {style}={style:'underline'}} result=classNames(style,'font-semibold')",
        "{const style='underline'} result=classNames(style,'font-semibold')",
        "function nested(){var style='underline'} result=classNames(style,'font-semibold')",
        "class Nested {static {var style='underline'}} result=classNames(style,'font-semibold')",
    ])('contains hoisted vars within their static block: %s', (block) => {
        expectRuntimeAgreement(`const style='text-body-m';let result;class C{static{${block}}}return result`)
    })

    it.each([
        "class C{static{if(flag){var style='underline'}}static{result=classNames(style,'font-semibold')}}",
        "class C{static{if(flag){var style='underline'}}static value=classNames(style,'font-semibold')}result=C.value",
    ])('keeps sibling static scopes independent: %s', (declaration) => {
        expectRuntimeAgreement(`const style='text-body-m';let result;${declaration};return result`)
    })

    it.each([
        "[['text-body-m','x'],['font-semibold']]",
        "[['x','text-body-m'],['font-semibold']]",
        "[['text-body-m'],['font-semibold','x']]",
        "[['text-body-m'],['x','font-semibold']]",
        "[['text-body-m'],['font-semibold']]",
        "[[['text-body-m']],'font-semibold']",
        "[['text-body-m ', 'x'],'font-semibold']",
        "[['x',' text-body-m'],'font-semibold']",
        "[{'text-body-m':true},'font-semibold']",
        "[['text-body-m',{}],'font-semibold']",
        "[[null,'text-body-m'],'font-semibold']",
        "[['text-body-m',undefined],'font-semibold']",
        "[[,'text-body-m'],'font-semibold']",
        "[[...[,],'text-body-m'],'font-semibold']",
        "[null,undefined,,'text-body-m','font-semibold']",
        "[...(flag?[['text-body-m']]:[['underline']]),'font-semibold']",
        "[(flag?['text-body-m']:['underline']),'font-semibold']",
        "[[['text-body-m'].join(' ')],'font-semibold']",
    ])('coerces joined items as strings: %s', (array) => {
        expectRuntimeAgreement(`return classNames((${array}).join(' '))`)
        expectRuntimeAgreement(`const items=${array};return classNames(items.join(' '))`)
    })

    it.each([
        "[['text-body-m','x'],['font-semibold']].join(' ')",
        "[['text-body-m'],['font-semibold']].join(' ')",
        "[['text-body-m'],['font-semibold','x']].join(' ')",
    ])('preserves joined text through primitive wrappers: %s', (expression) => {
        for (const wrapped of [
            `(${expression}) + ''`,
            `\`\${${expression}}\``,
            `({x:${expression}}).x`,
            `[[${expression}]].join(' ')`,
        ])
            expectRuntimeAgreement(`return classNames(${wrapped})`)
    })

    it.each(['1n', '0x1n', '0b1n', '0o1n', '1', "'1'"])('normalizes property keys for every selector: %s', (name) => {
        for (const selector of ['1n', '1', "'1'"])
            expectRuntimeAgreement(`const S={${name}:'text-body-m'};return classNames(S[${selector}],'font-semibold')`)
        expectRuntimeAgreement(`const S={${name}:'text-body-m',1:'underline'};return classNames(S[1n],'font-semibold')`)
        expectRuntimeAgreement(`const S={1:'underline',${name}:'text-body-m'};return classNames(S[1n],'font-semibold')`)
        expectRuntimeAgreement(
            `const S={...{${name}:'text-body-m'},1:'underline'};return classNames(S[1n],'font-semibold')`
        )
    })

    it.each(['1n(){}', 'get 1n(){return false}', 'set 1n(value){}', '[1n](){}'])(
        'normalizes keys on opaque method and accessor overrides: %s',
        (override) => {
            expectRuntimeAgreement(`const S={1:'text-body-m',${override}};return classNames(S[1],'font-semibold')`)
        }
    )
})
