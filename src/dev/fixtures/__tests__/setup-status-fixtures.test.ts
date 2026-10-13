import { FIXTURES } from '@/dev/fixtures/registry'
import type { UserCapabilities } from '@/types/capabilities'
import { setupRows } from '@/utils/kyc-setup-status.utils'

// The setup status fixtures read through the same mapping the drawer uses, so
// each one shows the state its name promises.

type SetupFixture = {
    me: { residence: { verified: string }; capabilities: UserCapabilities }
    plan: { features: { qr: boolean; local: boolean; bank: boolean; card: boolean } }
}

const rowsOf = (name: string) => {
    const responses = FIXTURES[name].responses as unknown as Record<string, unknown>
    const { me, plan } = {
        me: responses['GET /users/me'],
        plan: responses['GET /users/kyc/plan'],
    } as SetupFixture
    expect(responses['GET /users/kyc/profile']).toEqual(
        expect.objectContaining({ attempts: [expect.objectContaining({ kind: 'IDENTITY' })] })
    )
    return setupRows({
        features: plan.features,
        residence: me.residence.verified,
        capabilities: me.capabilities,
        identityVerified: true,
    }).map((row) => [row.key, row.state])
}

describe('setup status fixtures', () => {
    it.each([
        [
            'kyc-setup-all-available',
            [
                ['qr', 'available'],
                ['local', 'available'],
                ['bank', 'available'],
                ['card', 'available'],
            ],
        ],
        [
            'kyc-setup-bank-document-needed',
            [
                ['qr', 'available'],
                ['bank', 'document-needed'],
            ],
        ],
        [
            'kyc-setup-bank-address-review',
            [
                ['qr', 'available'],
                ['bank', 'under-review'],
            ],
        ],
        [
            'kyc-setup-card-agreements-needed',
            [
                ['qr', 'available'],
                ['card', 'agreements-needed'],
            ],
        ],
        [
            'kyc-setup-bank-terms-needed',
            [
                ['qr', 'available'],
                ['bank', 'terms-needed'],
                ['card', 'agreements-needed'],
            ],
        ],
        [
            'kyc-setup-bank-local-id-refused',
            [
                ['qr', 'available'],
                ['local', 'available'],
                ['bank', 'needs-local-id'],
            ],
        ],
        [
            'kyc-setup-local-account-refused',
            [
                ['qr', 'available'],
                ['local', 'not-available'],
            ],
        ],
    ])('%s', (name, rows) => {
        expect(rowsOf(name)).toEqual(rows)
    })
})
