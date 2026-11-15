// This catches proven formatting-to-number flows; it does not pretend static
// analysis can prove arbitrary JavaScript arithmetic finite.
module.exports = {
    meta: {
        type: 'problem',
        schema: [
            { type: 'object', properties: { banDirectFormatting: { type: 'boolean' } }, additionalProperties: false },
        ],
        messages: {
            formatted: 'Keep raw validated money separate from display strings. Do not parse formatter output.',
            direct: 'Use a validated finite display adapter for monetary UI.',
        },
    },
    create(context) {
        const formatters = new Set()
        const variables = new Set()
        const isFormatted = (node) => {
            if (!node) return false
            if (node.type === 'Identifier') return variables.has(node.name)
            if (node.type !== 'CallExpression') return false
            if (node.callee.type === 'Identifier' && formatters.has(node.callee.name)) {
                return !(originals.get(node.callee.name) === 'formatTokenAmount' && node.arguments[2]?.value === true)
            }
            if (node.callee.type === 'MemberExpression') return isFormatted(node.callee.object)
            return false
        }
        const originals = new Map()
        return {
            ImportDeclaration(node) {
                if (!/^@\/utils\/(currency|general\.utils|format\.utils)$/.test(node.source.value)) return
                for (const item of node.specifiers) {
                    if (item.type === 'ImportSpecifier' && /^format/.test(item.imported.name)) {
                        formatters.add(item.local.name)
                        originals.set(item.local.name, item.imported.name)
                    }
                }
            },
            VariableDeclarator(node) {
                if (node.id.type === 'Identifier' && isFormatted(node.init)) variables.add(node.id.name)
            },
            CallExpression(node) {
                const callee = node.callee
                const parse = callee.type === 'Identifier' && ['Number', 'parseFloat', 'parseInt'].includes(callee.name)
                const staticParse =
                    callee.type === 'MemberExpression' &&
                    callee.object.name === 'Number' &&
                    ['parseFloat', 'parseInt'].includes(callee.property.name)
                const arg = node.arguments[0]
                const inputMode =
                    arg?.type === 'CallExpression' &&
                    arg.callee.type === 'Identifier' &&
                    originals.get(arg.callee.name) === 'formatTokenAmount' &&
                    arg.arguments[2]?.value === true
                if ((parse || staticParse) && !inputMode && isFormatted(arg))
                    context.report({ node, messageId: 'formatted' })
                if (
                    context.options[0]?.banDirectFormatting &&
                    callee.type === 'MemberExpression' &&
                    ['toFixed', 'toLocaleString'].includes(callee.property.name)
                )
                    context.report({ node, messageId: 'direct' })
            },
        }
    },
}
