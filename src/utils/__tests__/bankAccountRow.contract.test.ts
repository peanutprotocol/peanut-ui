/** R19: omission is a compile-time error, so the public parameter must be required. */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { bankAccountRow } from '../unlock-payments.utils'

it('requires account context at every typed call site', () => {
    const source = ts.createSourceFile(
        'unlock-payments.utils.ts',
        fs.readFileSync(path.join(__dirname, '../unlock-payments.utils.ts'), 'utf8'),
        ts.ScriptTarget.Latest,
        true
    )
    const declaration = source.statements.find(
        (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === 'bankAccountRow'
    )!
    expect(declaration.parameters[2].questionToken).toBeUndefined()
    expect(declaration.parameters[2].initializer).toBeUndefined()
    if (false) {
        // @ts-expect-error account context must never silently disappear
        bankAccountRow([], 'active')
    }
})
