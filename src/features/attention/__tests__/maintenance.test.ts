import { DEFAULT_KILL_SWITCHES } from '@/features/kill-switches/kill-switches.consts'
import { selectMaintenance } from '../maintenance'

const off = {
    ...DEFAULT_KILL_SWITCHES,
    enableFullMaintenance: false,
    enableMaintenanceBanner: false,
    maintenanceBannerPaths: [],
}
const full = { ...off, enableFullMaintenance: true }
const scoped = { ...off, enableMaintenanceBanner: true }

describe('selectMaintenance', () => {
    test.each([full, scoped])('demo mode suppresses maintenance: %j', (config) => {
        // "demo mode → none"
        expect(selectMaintenance({ pathname: '/withdraw', config, demo: true })).toBe('none')
    })

    test.each(['/home', '/home/x'])('excludes %s under full and scoped maintenance', (pathname) => {
        for (const config of [full, scoped]) {
            // "'/home' and '/home/*' → none"
            expect(selectMaintenance({ pathname, config, demo: false })).toBe('none')
        }
    })

    test.each(['/', '/support', '/withdraw', '/withdraw/bank', '/setup', '/homework'])(
        'full maintenance shows on %s',
        (pathname) => {
            // "full maintenance → full"
            expect(
                selectMaintenance({
                    pathname,
                    config: { ...full, maintenanceBannerPaths: ['/different'] },
                    demo: false,
                })
            ).toBe('full')
        }
    )

    test.each(['/', '/withdraw', '/setup', '/recipient/pay'])(
        'scoped with an empty path list covers %s',
        (pathname) => {
            // "empty path list = every path"
            expect(selectMaintenance({ pathname, config: scoped, demo: false })).toBe('scoped')
        }
    )

    test.each([
        ['/withdraw', 'scoped'],
        ['/withdraw/bank', 'scoped'],
        ['/add-money', 'scoped'],
        ['/add-money/brazil/review', 'scoped'],
        ['/withdrawal', 'none'],
        ['/add-money-extra', 'none'],
        ['/support', 'none'],
        ['/', 'none'],
    ])('scoped prefixes: %s → %s', (pathname, expected) => {
        // "banner enabled and on a targeted path ... → scoped; else none"
        expect(
            selectMaintenance({
                pathname,
                config: { ...scoped, maintenanceBannerPaths: ['/withdraw', '/add-money'] },
                demo: false,
            })
        ).toBe(expected)
    })

    test.each(['/', '/withdraw', '/setup'])('off means none on %s', (pathname) => {
        // "else none"
        expect(selectMaintenance({ pathname, config: off, demo: false })).toBe('none')
    })

    test.each([null, undefined, ''])('an unreadable path is none: %s', (pathname) => {
        // "maintenance on /home, in demo mode, unreadable path ... handle: none"
        expect(selectMaintenance({ pathname: pathname as string, config: full, demo: false })).toBe('none')
    })
})
