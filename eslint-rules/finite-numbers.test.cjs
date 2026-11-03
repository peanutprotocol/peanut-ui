const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Linter } = require('eslint')
const rule = require('./finite-numbers.cjs')
const verify = (code, options = {}) =>
    new Linter().verify(code, [
        {
            languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
            plugins: { numeric: { rules: { finite: rule } } },
            rules: { 'numeric/finite': ['error', options] },
        },
    ])

test('rejects numeric conversion of formatted display results, aliases and local variables', () => {
    for (const code of [
        "import {formatAmountNumber} from '@/utils/currency'; Number(formatAmountNumber(4000))",
        "import {formatBankAmount as fmt} from '@/utils/currency'; parseFloat(fmt(12,'USD'))",
        "import {formatAmountNumber as fmt} from '@/utils/currency'; const label=fmt(4000); Number(label.replace(/,/g,''))",
    ])
        assert.equal(verify(code).length, 1, code)
})
test('raw input parsing and input-mode formatting remain allowed', () => {
    for (const code of [
        'const amount = Number(raw)',
        "import {formatTokenAmount} from '@/utils/general.utils'; Number(formatTokenAmount('12',2,true))",
        'const date = new Date().toLocaleString()',
    ])
        assert.equal(verify(code).length, 0, code)
})
test('migrated monetary display modules must use validated display adapters', () => {
    assert.equal(verify('const display = amount.toFixed(2)', { banDirectFormatting: true }).length, 1)
    assert.equal(verify('const display = amount.toLocaleString()', { banDirectFormatting: true }).length, 1)
    assert.equal(verify('const display = formatFiniteDisplay(amount)', { banDirectFormatting: true }).length, 0)
})
