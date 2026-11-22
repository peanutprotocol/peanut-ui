import { FULL_MAINTENANCE_ALLOWED_PATHS } from '@/features/kill-switches/kill-switches.consts'
import { maintenanceRedirectTarget } from '@/features/kill-switches/kill-switches.utils'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ITEMS_TO_DISABLE } = require('../native-build') as { ITEMS_TO_DISABLE: Array<{ path: string; type: string }> }

// The route each removed dir or page.tsx served, ignoring route groups such as (mobile-ui).
const removedRoutes = ITEMS_TO_DISABLE.filter((item) => item.type === 'dir' || item.path.endsWith('page.tsx')).map(
    (item) => '/' + item.path.replace(/\/?page\.tsx$/, '').replace(/\([^)]*\)\/?/g, '')
)

describe('native export keeps the routes the app navigates to (TASK-24130)', () => {
    it('keeps /maintenance, where full maintenance sends every user', () => {
        const target = maintenanceRedirectTarget('/home', true, false, true)
        expect(target).toBe('/maintenance')
        expect(removedRoutes).not.toContain(target)
    })

    it('keeps every page full maintenance lets the user stay on', () => {
        for (const path of FULL_MAINTENANCE_ALLOWED_PATHS) expect(removedRoutes).not.toContain(path)
    })
})
