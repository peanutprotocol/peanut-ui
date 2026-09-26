import { readdirSync } from 'node:fs'
import { join } from 'node:path'
export function routePatterns(root) {
    const walk = (p) =>
        readdirSync(p, { withFileTypes: true }).flatMap((e) =>
            e.isDirectory() ? walk(join(p, e.name)) : [join(p, e.name)]
        )
    return walk(join(root, 'src/app'))
        .filter((p) => /\/page\.(tsx|ts|jsx|js)$/.test(p))
        .map(
            (p) =>
                '/' +
                p
                    .slice(join(root, 'src/app').length + 1)
                    .replace(/(^|\/)page\.[^.]+$/, '')
                    .split('/')
                    .filter((s) => s && !s.startsWith('('))
                    .join('/')
        )
}
export function routePatternFor(pathname, patterns) {
    const matches = patterns.filter((pattern) => {
        const parts = pattern
            .split('/')
            .map((s) =>
                s.startsWith('[[...')
                    ? '.*'
                    : s.startsWith('[...')
                      ? '.+'
                      : s.startsWith('[')
                        ? '[^/]+'
                        : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            )
        return new RegExp('^' + parts.join('/') + '/?$').test(pathname)
    })
    // Next resolves segment by segment: /pay/[...recipient] wins over /[locale]/[country].
    const rank = (segment) =>
        !segment
            ? 0
            : segment.startsWith('[[...')
              ? 3
              : segment.startsWith('[...')
                ? 2
                : segment.startsWith('[')
                  ? 1
                  : 0
    return matches.sort((a, b) => {
        const left = a.split('/'),
            right = b.split('/')
        for (let i = 0; i < Math.max(left.length, right.length); i++) {
            const difference = rank(left[i]) - rank(right[i])
            if (difference) return difference
        }
        return b.length - a.length
    })[0]
}
