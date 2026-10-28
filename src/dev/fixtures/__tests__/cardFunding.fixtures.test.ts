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
import type { RainCardFunding, RainFundingAccess, RainFundingManagementStatus } from '@/services/rain'
import { DEMO_ADDRESS } from '@/constants/demo-data'
import { RTF_AUTHORIZATION_TEXT, RTF_SUPPORTED_SCOPE_VERSION } from '@/constants/rain.consts'
import { parseLegacyMigration } from '@/utils/legacyGrantMigration.utils'

const FUNDING = 'GET /rain/cards/funding'
const PATH = '/rain/cards/funding'

const ACCESS = 'GET /rain/cards/funding/access'
const ACCESS_PATH = '/rain/cards/funding/access'

const accessFixtures = Object.entries(FIXTURES).filter(([, fixture]) => fixture.responses?.[ACCESS] !== undefined)
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
        expect(body.management).toEqual({ status: 'ready', reason: null, migration: null, stop: null })
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
            stop: null,
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

    it('every funding fixture declares its own funding decision, so none defaults by accident', () => {
        for (const [name, fixture] of fundingFixtures) {
            // declared as an answer, or as a failed read (fails closed)
            const declared = fixture.responses![ACCESS] !== undefined || !!fixture.fails?.includes(ACCESS)
            expect({ name, declared }).toEqual({ name, declared: true })
        }
    })

    it('the funding wallet is the demo wallet, the one the surfaces check scope against', async () => {
        for (const [name] of fundingFixtures) {
            expect((await read(name)).walletAddress.toLowerCase()).toBe(DEMO_ADDRESS.toLowerCase())
        }
    })

    describe('funding access', () => {
        const accessOf = async (name: string): Promise<RainFundingAccess> =>
            (await answer(name, ACCESS_PATH, 'GET')).json()

        it.each(accessFixtures.map(([name]) => [name]))('%s: answers exactly the contract shape', async (name) => {
            const body = await accessOf(name)
            expect(Object.keys(body).sort()).toEqual(['enrollmentAllowed', 'fundingMode'])
            expect(['legacy', 'managed']).toContain(body.fundingMode)
            expect(typeof body.enrollmentAllowed).toBe('boolean')
        })

        it('the demo default is a managed account, so an undeclared card fixture is not a legacy one', async () => {
            expect(await accessOf('home')).toEqual({ fundingMode: 'managed', enrollmentAllowed: true })
        })

        it('accepted states keep finishing after new enrollment closed (managed, not allowed)', async () => {
            for (const name of ['card-funding-pending', 'card-funding-withdrawal-in-flight', 'card-funding-enabled']) {
                expect(await accessOf(name)).toEqual({ fundingMode: 'managed', enrollmentAllowed: false })
            }
        })

        it('states that ask for a grant belong to managed accounts', async () => {
            for (const name of ['card-funding-needed', 'card-funding-migration', 'card-funding-return']) {
                expect((await accessOf(name)).fundingMode).toBe('managed')
            }
        })

        it('the collateral fixtures state their scope: managed ready, or the existing permission', async () => {
            expect(await accessOf('card-holder-collateral')).toMatchObject({ fundingMode: 'managed' })
            expect((await read('card-holder-collateral')).management.status).toBe('ready')
            expect(await accessOf('card-holder-collateral-legacy')).toEqual({
                fundingMode: 'legacy',
                enrollmentAllowed: false,
            })
        })

        it('the not-yet-accepted fixture is eligible, on the existing permission, with the funding read withheld', async () => {
            expect(await accessOf('card-funding-enrollment')).toEqual({
                fundingMode: 'legacy',
                enrollmentAllowed: true,
            })
            const { management } = await read('card-funding-enrollment')
            expect(management).toMatchObject({
                status: 'temporarily_unavailable',
                reason: 'enrollment_required',
                migration: null,
            })
        })

        it('the existing-permission fixtures have contracts on file and no stored approval', async () => {
            for (const name of ['card-funding-legacy', 'card-funding-access-error']) {
                const { status, cards } = await (await answer(name, '/rain/cards', 'GET')).json()
                expect(status.contractAddress).toBeTruthy()
                expect(status.coordinatorAddress).toBeTruthy()
                expect(cards[0].hasWithdrawApproval).toBe(false)
            }
            expect(await accessOf('card-funding-legacy')).toEqual({ fundingMode: 'legacy', enrollmentAllowed: false })
        })

        it('re-issue: eligible gets the managed terms path, the rest the existing one', async () => {
            expect(await accessOf('card-reissue')).toEqual({ fundingMode: 'legacy', enrollmentAllowed: true })
            expect(await accessOf('card-reissue-legacy')).toEqual({ fundingMode: 'legacy', enrollmentAllowed: false })
        })

        it('an unreadable decision stays unreadable (fails closed), and so does an unreadable funding state', async () => {
            expect((await answer('card-funding-access-error', ACCESS_PATH, 'GET')).status).toBe(500)
            expect((await answer('card-funding-error', PATH, 'GET')).status).toBe(500)
            expect(await accessOf('card-funding-error')).toEqual({ fundingMode: 'managed', enrollmentAllowed: true })
        })
    })

    it('only the states that ask for a grant carry a migration payload, and only migration_required does', async () => {
        for (const [name] of fundingFixtures) {
            const { management } = await read(name)
            expect(management.migration !== null).toBe(management.status === 'migration_required')
        }
    })
})
