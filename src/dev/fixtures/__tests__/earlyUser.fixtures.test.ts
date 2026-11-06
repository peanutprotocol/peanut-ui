/**
 * @jest-environment node
 *
 * The early-user capture opens the drawer on Home on its first load. The
 * announcement itself waits for a quiet third session, so the fixture's
 * attention answer must carry a policy that lets it open.
 */
import { answer } from '../../../../scripts/screens/adapter'
import { decide } from '@/features/attention/decide'
import { ASKS } from '@/features/attention/registry'
import { applyServerRanking, asServerAttention } from '@/features/attention/serverAttention'
import { baseSession, state } from '@/features/attention/__tests__/legacy-manager.fixture'

const firstSession = { ...baseSession, count: 1 }
const earlyUser = state({ showEarlyUserModal: true })

describe('early-user fixture', () => {
    it('opens the drawer over the to-do list on the first session', async () => {
        const server = asServerAttention(await (await answer('early-user', '/users/me/attention', 'GET')).json())
        expect(server?.catalogueVersion).toBeDefined()

        expect(decide(earlyUser, applyServerRanking(ASKS, server), {}, firstSession).interrupt).toBe('early-user')
    })

    it('without it, the bundled policy keeps the announcement for a quiet session', () => {
        expect(decide(earlyUser, ASKS, {}, firstSession).interrupt).toBeNull()
    })
})
