const postcss = require('postcss')

// parse css rather than counting selector names, comments and token definitions as use sites.
function cssUseSites(text) {
    const root = postcss.parse(text)
    root.walkAtRules('theme', (rule) => rule.remove())
    const apply = []
    const declarations = []
    root.walkAtRules('apply', (rule) => apply.push(rule.params))
    root.walkDecls((declaration) => declarations.push(declaration.value))
    return { apply: apply.join('\n'), declarations: declarations.join('\n') }
}

function countAlphaSemanticTokens(text, tokens) {
    if (!tokens.size) return 0
    const names = [...tokens].join('|')
    const color = `(?:${names})`
    const prefixes =
        'bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|inset-ring|shadow|inset-shadow|drop-shadow|text-shadow|fill|stroke|divide|outline|decoration|caret|accent|placeholder|from|via|to'
    const utility = new RegExp(
        `(?<![\\w-])(?:${prefixes})-(?:${color}|\\((?:color:)?--color-${color}\\)|\\[(?:color:)?var\\(--color-${color}\\)\\])/(?:[0-9]+(?:\\.[0-9]+)?|\\[[^\\]\\s]+\\]|\\([^\\)\\s]+\\))`,
        'g'
    )
    let count = 0
    for (const line of text.split('\n')) {
        for (const match of line.matchAll(utility)) {
            // the interim skeleton tint is approved; this is not a general surface tint.
            if (
                match[0] === 'bg-foreground-primary/10' &&
                !line.slice(0, match.index).endsWith(':') &&
                /(?<![\w-])animate-pulse(?![\w-])/.test(line)
            )
                continue
            count++
        }
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
