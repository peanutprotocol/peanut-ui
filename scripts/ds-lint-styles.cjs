const postcss = require('postcss')
const ts = require('typescript')

// parse css rather than counting selector names, comments and token definitions as use sites.
function cssUseSites(text) {
    const root = postcss.parse(text)
    root.walkAtRules('theme', (rule) => rule.remove())
    const apply = []
    const declarations = []
    root.walkAtRules('apply', (rule) => apply.push(rule.params))
    root.walkDecls((declaration) => declarations.push(declaration.value))
    return { apply: apply.join('\n'), declarations: declarations.join('\n'), classLists: apply }
}

function countAlphaSemanticTokens(text, tokens, { filename = 'source.tsx', classList = false } = {}) {
    if (!tokens.size) return 0
    const skeletonRanges = []
    const hasPulse = (value) => value.split(/\s+/).includes('animate-pulse')
    if (text.includes('animate-pulse')) {
        if (classList) {
            if (hasPulse(text)) skeletonRanges.push([0, text.length])
        } else {
            // only a complete literal can grant an exception; unresolved expressions stay counted.
            const kind = filename.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.TSX
            const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, kind)
            const visit = (node) => {
                if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && hasPulse(node.text)) {
                    skeletonRanges.push([node.getStart(source), node.end])
                }
                ts.forEachChild(node, visit)
            }
            if (source.parseDiagnostics.length === 0) visit(source)
        }
    }
    const names = [...tokens].join('|')
    const color = `(?:${names})`
    const prefixes =
        'bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|inset-ring|shadow|inset-shadow|drop-shadow|text-shadow|fill|stroke|divide|outline|decoration|caret|accent|placeholder|from|via|to'
    const utility = new RegExp(
        `(?<![\\w-])(?:${prefixes})-(?:${color}|\\((?:color:)?--color-${color}\\)|\\[(?:color:)?var\\(--color-${color}\\)\\])/(?:[0-9]+(?:\\.[0-9]+)?|\\[[^\\]\\s]+\\]|\\([^\\)\\s]+\\))`,
        'g'
    )
    let count = 0
    for (const match of text.matchAll(utility)) {
        // the interim skeleton tint is approved only within this same class list.
        if (
            match[0] === 'bg-foreground-primary/10' &&
            text[match.index - 1] !== ':' &&
            skeletonRanges.some(([start, end]) => match.index >= start && match.index + match[0].length <= end)
        )
            continue
        count++
    }

    // tailwind's css functions and relative colors must not bypass the class rule.
    const functions = /\b(color-mix|theme|rgba?|hsla?|oklch|oklab|lch|lab)\(|--alpha\(/g
    const reference = new RegExp(`--color-${color}(?![\\w-])`)
    for (const match of text.matchAll(functions)) {
        let depth = 1
        let end = match.index + match[0].length
        const start = end
        while (end < text.length && depth) {
            if (text[end] === '(') depth++
            if (text[end] === ')') depth--
            end++
        }
        const value = text.slice(start, end - 1)
        if (reference.test(value) && (match[0] === 'color-mix(' || match[0] === '--alpha(' || value.includes('/'))) {
            count++
        }
    }
    return count
}

module.exports = { cssUseSites, countAlphaSemanticTokens }
