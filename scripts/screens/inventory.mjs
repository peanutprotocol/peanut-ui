import { routePatterns, routePatternFor } from './routes.mjs'
// Reviewed v1 boundaries. Product routes without a scenario stay visible as gaps.
export function inventory(root, catalogue) {
    const patterns = [...new Set(routePatterns(root))].sort()
    const byRoute = new Map()
    for (const screen of catalogue) {
        if (screen.kind !== 'route') continue
        const pattern = screen.routePattern ?? routePatternFor(screen.route.split('?')[0], patterns)
        if (pattern) byRoute.set(pattern, [...(byRoute.get(pattern) ?? []), screen.id])
    }
    return patterns.map((route) => {
        const screens = byRoute.get(route) ?? []
        const reason =
            route === '/add-money/us/bank'
                ? 'Legacy standalone bank-details entry with no in-app navigation entry; current bank journeys use /add-money/[country]/bank'
                : route.startsWith('/dev') || route === '/shhhhh'
                  ? 'Developer tooling, outside the app catalogue'
                  : route.startsWith('/quests') ||
                      route.startsWith('/[locale]') ||
                      ['/', '/careers', '/lp', '/es-419', '/es-ar', '/pt-br'].includes(route) ||
                      route.startsWith('/m/')
                    ? 'Marketing, editorial or legal website, outside app-owned mobile UI'
                    : route === '/app'
                      ? 'Platform download redirect; destination is outside app-owned UI'
                      : route === '/crisp-proxy'
                        ? 'Third-party support iframe; app-owned support drawer is catalogued separately'
                        : undefined
        return {
            route,
            status: reason ? 'excluded' : screens.length ? 'catalogued' : 'missing',
            screens,
            ...(reason
                ? { reason }
                : !screens.length
                  ? { reason: 'App route needs a repeatable synthetic scenario' }
                  : {}),
        }
    })
}
