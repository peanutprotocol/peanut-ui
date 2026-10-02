/**
 * @jest-environment node
 *
 * The managed card funding fixtures must answer `GET /rain/cards/funding` the
 * way the API does, in BOTH places a fixture is served:
 *  - the in-app fixture layer (registry `responses`), and
 *  - the screen-capture adapter, which asks the demo API first in strict mode
 *    and only then overlays the fixture. A path the demo API does not know
 *    fails that screen with "Missing synthetic responses" — the regression this
 *    file pins.
 */
import { answer } from '../../../../scripts/screens/adapter'
import { FIXTURES } from '@/dev/fixtures/registry'
import type { RainCardFunding, RainFundingManagementStatus } from '@/services/rain'
import { RTF_AUTHORIZATION_TEXT, RTF_SUPPORTED_SCOPE_VERSION } from '@/constants/rain.consts'
import { parseLegacyMigration } from '@/utils/legacyGrantMigration.utils'

const FUNDING = 'GET /rain/cards/funding'
const PATH = '/rain/cards/funding'

const fundingFixtures = Object.entries(FIXTURES).filter(([, fixture]) => fixture.responses?.[FUNDING] !== undefined)
const read = async (name: string): Promise<RainCardFunding> => (await answer(name, PATH, 'GET')).json()

describe('card funding fixtures', () => {
    it('cover every management status the Home prompt reacts to', () => {
        const statuses = new Set(
            fundingFixtures.map(
                ([, fixture]) => (fixture.responses![FUNDING] as RainCardFunding).management.status as string
            )
        )
        const expected: RainFundingManagementStatus[] = [
            'required',
            'migration_required',
            'pending',
            'ready',
            'temporarily_unavailable',
        ]
        expect([...statuses].sort()).toEqual(expect.arrayContaining([...expected].sort()))
    })

    it.each(fundingFixtures.map(([name]) => [name]))(
        '%s: the capture adapter answers with the fixture state and the current contract',
        async (name) => {
            const declared = FIXTURES[name].responses![FUNDING] as RainCardFunding
            const body = await read(name)
            expect(body.management.status).toBe(declared.management.status)
            expect(body.permission.scopeVersion).toBe(RTF_SUPPORTED_SCOPE_VERSION)
            expect(body.permission.authorizationText).toBe(RTF_AUTHORIZATION_TEXT)
            expect(body.permission.ceiling).toMatch(/^[1-9][0-9]*$/)
            expect(body.sessionKeyAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
            expect(body.walletAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
        }
    )

    it('a fixture with no funding override still answers, and its permission is ready (no prompt over other card screens)', async () => {
        const body = await read('home')
        expect(body.management).toEqual({ status: 'ready', reason: null, migration: null })
    })

    it('the migration fixture carries a payload the app accepts to act on', async () => {
        const body = await read('card-funding-migration')
        expect(body.management.status).toBe('migration_required')
        expect(() => parseLegacyMigration(body.management.migration)).not.toThrow()
    })

    it('the in-flight fixture answers a paused state with the withdrawal reason and no migration', async () => {
        const body = await read('card-funding-withdrawal-in-flight')
        expect(body.management).toEqual({
            status: 'temporarily_unavailable',
            reason: 'withdrawal_in_flight',
            migration: null,
        })
    })

    it('the return fixtures carry a fresh positive card balance', async () => {
        for (const name of ['card-funding-return', 'card-holder-collateral']) {
            const overview = await (await answer(name, '/rain/cards', 'GET')).json()
            expect(overview.balance.spendingPower).toBeGreaterThan(0)
            expect(overview.balanceUnavailable).toBeFalsy()
        }
    })

    it('a fixture that declares the funding read as failed makes it fail', async () => {
        const response = await answer('card-funding-error', PATH, 'GET')
        expect(response.status).toBe(500)
    })

    it('only the states that ask for a grant carry a migration payload, and only migration_required does', async () => {
        for (const [name] of fundingFixtures) {
            const { management } = await read(name)
            expect(management.migration !== null).toBe(management.status === 'migration_required')
        }
    })
})
