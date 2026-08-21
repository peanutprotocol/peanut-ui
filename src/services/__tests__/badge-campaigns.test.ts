import {
    claimAndSettlePendingBadgeCampaigns,
    claimBadgeCampaigns,
    destinationForConfirmedBadgeCampaignAcquisition,
    pendingBadgeCampaignsAfterClaims,
} from '../badge-campaigns'
import {
    PENDING_BADGE_CAMPAIGN_INTENT_EPOCH_STORAGE_KEY,
    clearPendingBadgeCampaigns,
    getPendingBadgeCampaigns,
    queuePendingBadgeCampaigns,
    savePendingBadgeCampaigns,
} from '@/components/Invites/badge-campaign-context'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

function response(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue(body),
    } as unknown as Response
}

function claim(badgeCampaign: string, outcome: string, badgeCode?: string) {
    return {
        badgeCampaign,
        outcome,
        ...(badgeCode ? { badgeCode } : {}),
    }
}

function legacyClaim(campaignTag: string, outcome: string, badgeCode?: string) {
    return {
        campaignTag,
        outcome,
        ...(badgeCode ? { badgeCode } : {}),
    }
}

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise
    })
    return { promise, resolve }
}

describe('badge badge campaign claims contract', () => {
    beforeEach(() => {
        mockServerFetch.mockReset()
        clearPendingBadgeCampaigns()
    })

    afterAll(() => clearPendingBadgeCampaigns())

    it('trims, case-insensitively dedupes, and forwards opaque identities in one canonical request', async () => {
        mockServerFetch.mockResolvedValue(
            response(200, {
                claims: [claim('NITA', 'awarded', 'NITA'), claim('Creator/Summer', 'already_owned')],
            })
        )

        const result = await claimBadgeCampaigns([' NITA ', 'nita', 'Creator/Summer'])

        expect(result.transport).toBe('canonical')
        expect(result.claims.map(({ badgeCampaign }) => badgeCampaign)).toEqual(['NITA', 'Creator/Summer'])
        expect(mockServerFetch).toHaveBeenCalledTimes(1)
        expect(mockServerFetch).toHaveBeenCalledWith('/badge/claims', {
            method: 'POST',
            body: JSON.stringify({ badgeCampaigns: ['NITA', 'Creator/Summer'] }),
        })
        expect(mockServerFetch.mock.calls[0][1]?.body).not.toContain('code')
    })

    it('normalizes a rolling-deploy legacy response echo at the runtime boundary', async () => {
        mockServerFetch.mockResolvedValue(
            response(200, { claims: [legacyClaim('published-legacy', 'already_owned', 'LEGACY_BADGE')] })
        )

        const result = await claimBadgeCampaigns(['published-legacy'])

        expect(result.claims).toEqual([
            {
                badgeCampaign: 'published-legacy',
                badgeCode: 'LEGACY_BADGE',
                outcome: 'already_owned',
            },
        ])
    })

    it('settles source-qualified UTM identities only from typed backend outcomes', async () => {
        const qualifiedIdentities = [
            'utm:token-nation-2026',
            'utm:touched-grass',
            'utm:festa-junina',
            'utm:card-alpha',
            'utm:irl-nomads',
        ]
        mockServerFetch.mockResolvedValue(
            response(200, {
                claims: qualifiedIdentities.map((badgeCampaign) => claim(badgeCampaign, 'awarded')),
            })
        )

        const result = await claimAndSettlePendingBadgeCampaigns(qualifiedIdentities)

        expect(JSON.parse(String(mockServerFetch.mock.calls[0][1]?.body))).toEqual({
            badgeCampaigns: qualifiedIdentities,
        })
        expect(result.claims.map(({ badgeCampaign }) => badgeCampaign)).toEqual(qualifiedIdentities)
        expect(result.pending).toEqual([])
    })

    it('accepts a catalog badge whose optional artwork is null', async () => {
        mockServerFetch.mockResolvedValue(
            response(200, {
                claims: [
                    {
                        badgeCampaign: 'new-badge',
                        badgeCode: 'NEW_BADGE',
                        badge: {
                            code: 'NEW_BADGE',
                            name: 'New Badge',
                            description: null,
                            publicDescription: null,
                            iconUrl: null,
                        },
                        outcome: 'awarded',
                    },
                ],
            })
        )

        const result = await claimAndSettlePendingBadgeCampaigns(['new-badge'])

        expect(result.claims[0]).toMatchObject({ outcome: 'awarded', badge: { iconUrl: null } })
        expect(result.pending).toEqual([])
    })

    it('aligns backend echoes case-insensitively and retains only definition_missing in a mixed batch', async () => {
        savePendingBadgeCampaigns(['NITA', 'Old', 'Mystery', 'Deploying'])
        mockServerFetch.mockResolvedValue(
            response(200, {
                claims: [
                    claim('nita', 'awarded', 'NITA'),
                    claim('old', 'expired'),
                    claim('MYSTERY', 'unknown'),
                    claim('deploying', 'definition_missing'),
                ],
            })
        )

        const result = await claimAndSettlePendingBadgeCampaigns()

        expect(result.pending).toEqual(['Deploying'])
        expect(getPendingBadgeCampaigns()).toEqual(['Deploying'])
    })

    it.each(['awarded', 'already_owned', 'inactive', 'expired', 'unknown'])(
        'consumes the terminal %s outcome',
        async (outcome) => {
            mockServerFetch.mockResolvedValue(response(200, { claims: [claim('campaign', outcome)] }))

            const result = await claimAndSettlePendingBadgeCampaigns(['campaign'])

            expect(result.pending).toEqual([])
            expect(getPendingBadgeCampaigns()).toEqual([])
        }
    )

    it('retains a requested identity omitted from an otherwise valid response', async () => {
        mockServerFetch.mockResolvedValue(response(200, { claims: [claim('one', 'awarded')] }))

        const result = await claimAndSettlePendingBadgeCampaigns(['one', 'two'])

        expect(result.claims[1]).toMatchObject({ badgeCampaign: 'two', outcome: 'retryable_error' })
        expect(result.pending).toEqual(['two'])
        expect(getPendingBadgeCampaigns()).toEqual(['two'])
    })

    it.each([
        {},
        { claims: null },
        {
            claims: [
                {
                    badgeCampaign: 123,
                    campaignTag: 'one',
                    outcome: 'awarded',
                },
            ],
        },
        {
            claims: [
                {
                    badgeCampaign: 'one',
                    outcome: 'awarded',
                    badgeCode: 123,
                },
            ],
        },
        {
            claims: [
                {
                    badgeCampaign: 'one',
                    outcome: 'awarded',
                    badge: { code: 'ONE', name: 'One', description: null, iconUrl: 123 },
                },
            ],
        },
    ])('retains the identity for a malformed canonical 200 body %#', async (body) => {
        mockServerFetch.mockResolvedValue(response(200, body))

        const result = await claimAndSettlePendingBadgeCampaigns(['one'])

        expect(result.claims[0]).toMatchObject({ badgeCampaign: 'one', outcome: 'retryable_error' })
        expect(result.pending).toEqual(['one'])
    })

    it('uses a present canonical response identity instead of a conflicting legacy echo', async () => {
        mockServerFetch.mockResolvedValue(
            response(200, {
                claims: [{ badgeCampaign: 'one', campaignTag: 'other', outcome: 'awarded' }],
            })
        )

        const result = await claimAndSettlePendingBadgeCampaigns(['one'])

        expect(result.claims).toEqual([{ badgeCampaign: 'one', outcome: 'awarded' }])
        expect(result.pending).toEqual([])
    })

    it('settles valid entries while retaining a malformed entry from the same 200 response', async () => {
        mockServerFetch.mockResolvedValue(
            response(200, {
                claims: [
                    claim('valid', 'awarded'),
                    {
                        badgeCampaign: 'partial',
                        outcome: 'awarded',
                        badgeCode: 123,
                    },
                ],
            })
        )

        const result = await claimAndSettlePendingBadgeCampaigns(['valid', 'partial'])

        expect(result.claims.map(({ outcome }) => outcome)).toEqual(['awarded', 'retryable_error'])
        expect(result.pending).toEqual(['partial'])
    })

    it('does not drop a different pending campaign while settling a subset', async () => {
        savePendingBadgeCampaigns(['Claimed-Now', 'Earlier-Retry'])
        mockServerFetch.mockResolvedValue(response(200, { claims: [claim('claimed-now', 'awarded')] }))

        const result = await claimAndSettlePendingBadgeCampaigns(['Claimed-Now'])

        expect(result.pending).toEqual(['Earlier-Retry'])
        expect(getPendingBadgeCampaigns()).toEqual(['Earlier-Retry'])
    })

    it.each(['older-first', 'newer-first'] as const)(
        'merge-safely settles concurrent cookie batches when %s completes',
        async (completionOrder) => {
            const olderResponse = deferred<Response>()
            const newerResponse = deferred<Response>()
            mockServerFetch.mockImplementation((_path, options) => {
                const badgeCampaigns = JSON.parse(String(options?.body)).badgeCampaigns as string[]
                return badgeCampaigns[0] === 'Older' ? olderResponse.promise : newerResponse.promise
            })

            savePendingBadgeCampaigns(['Older'])
            const olderClaim = claimAndSettlePendingBadgeCampaigns(['Older'])
            queuePendingBadgeCampaigns(['Newer'])
            const newerClaim = claimAndSettlePendingBadgeCampaigns(['Newer'])

            if (completionOrder === 'older-first') {
                olderResponse.resolve(response(200, { claims: [claim('Older', 'awarded')] }))
                await olderClaim
                expect(getPendingBadgeCampaigns()).toEqual(['Newer'])
                newerResponse.resolve(response(200, { claims: [claim('Newer', 'awarded')] }))
                await newerClaim
            } else {
                newerResponse.resolve(response(200, { claims: [claim('Newer', 'awarded')] }))
                await newerClaim
                expect(getPendingBadgeCampaigns()).toEqual(['Older'])
                olderResponse.resolve(response(200, { claims: [claim('Older', 'awarded')] }))
                await olderClaim
            }

            expect(getPendingBadgeCampaigns()).toEqual([])
        }
    )

    it.each([401, 408, 425, 429, 500, 503])('retains badge campaigns after retryable HTTP %s', async (status) => {
        mockServerFetch.mockResolvedValue(response(status, { error: 'retry later' }))

        const result = await claimAndSettlePendingBadgeCampaigns(['Retry-Me'])

        expect(result.claims).toEqual([
            expect.objectContaining({ badgeCampaign: 'Retry-Me', outcome: 'retryable_error', httpStatus: status }),
        ])
        expect(result.pending).toEqual(['Retry-Me'])
    })

    it('does not resurrect retryable intent when explicit logout wins an in-flight claim race', async () => {
        const pendingResponse = deferred<Response>()
        mockServerFetch.mockReturnValue(pendingResponse.promise)
        savePendingBadgeCampaigns(['First-Account'])

        const inFlightClaim = claimAndSettlePendingBadgeCampaigns()
        clearPendingBadgeCampaigns()
        pendingResponse.resolve(response(503, { error: 'retry later' }))

        const result = await inFlightClaim
        expect(result.claims[0]).toMatchObject({ badgeCampaign: 'First-Account', outcome: 'retryable_error' })
        expect(result.pending).toEqual([])
        expect(getPendingBadgeCampaigns()).toEqual([])
    })

    it('does not resurrect retryable intent after another tab advances the logout epoch', async () => {
        const pendingResponse = deferred<Response>()
        mockServerFetch.mockReturnValue(pendingResponse.promise)
        savePendingBadgeCampaigns(['First-Account'])

        const inFlightClaim = claimAndSettlePendingBadgeCampaigns()
        const currentEpoch = JSON.parse(
            localStorage.getItem(PENDING_BADGE_CAMPAIGN_INTENT_EPOCH_STORAGE_KEY) ?? '0'
        ) as number
        localStorage.setItem(PENDING_BADGE_CAMPAIGN_INTENT_EPOCH_STORAGE_KEY, JSON.stringify(currentEpoch + 1))
        savePendingBadgeCampaigns([])
        pendingResponse.resolve(response(503, { error: 'retry later' }))

        const result = await inFlightClaim
        expect(result.pending).toEqual([])
        expect(getPendingBadgeCampaigns()).toEqual([])
    })

    it('never reuses an in-flight campaign response across an explicit account switch', async () => {
        const firstAccountResponse = deferred<Response>()
        const secondAccountResponse = deferred<Response>()
        mockServerFetch
            .mockReturnValueOnce(firstAccountResponse.promise)
            .mockReturnValueOnce(secondAccountResponse.promise)
        savePendingBadgeCampaigns(['Shared-Campaign'])

        const firstAccountClaim = claimAndSettlePendingBadgeCampaigns()
        clearPendingBadgeCampaigns()
        queuePendingBadgeCampaigns(['Shared-Campaign'])
        const secondAccountClaim = claimAndSettlePendingBadgeCampaigns()

        expect(mockServerFetch).toHaveBeenCalledTimes(2)
        firstAccountResponse.resolve(
            response(200, { claims: [claim('Shared-Campaign', 'awarded', 'FIRST_ACCOUNT_BADGE')] })
        )
        const staleResult = await firstAccountClaim
        expect(staleResult.pending).toEqual(['Shared-Campaign'])
        expect(getPendingBadgeCampaigns()).toEqual(['Shared-Campaign'])

        secondAccountResponse.resolve(response(503, { error: 'retry later' }))
        const currentResult = await secondAccountClaim
        expect(currentResult.claims[0]).toMatchObject({ outcome: 'retryable_error', httpStatus: 503 })
        expect(currentResult.pending).toEqual(['Shared-Campaign'])
        expect(getPendingBadgeCampaigns()).toEqual(['Shared-Campaign'])
    })

    it('retains badge campaigns after a network failure', async () => {
        mockServerFetch.mockRejectedValue(new Error('offline'))

        const result = await claimAndSettlePendingBadgeCampaigns(['Retry-Me'])

        expect(result.claims[0].outcome).toBe('retryable_error')
        expect(result.pending).toEqual(['Retry-Me'])
    })

    it.each([400, 403, 422])('consumes canonical terminal schema HTTP %s without legacy fallback', async (status) => {
        mockServerFetch.mockResolvedValue(response(status, { error: 'invalid campaign input' }))

        const result = await claimAndSettlePendingBadgeCampaigns(['Bad'])

        expect(result.claims[0]).toMatchObject({ outcome: 'unknown', httpStatus: status })
        expect(result.pending).toEqual([])
        expect(mockServerFetch).toHaveBeenCalledTimes(1)
    })

    it.each([404, 405])('uses the compatibility endpoint only when canonical returns %s', async (status) => {
        mockServerFetch
            .mockResolvedValueOnce(response(status, { error: 'not deployed' }))
            .mockResolvedValueOnce(response(200, { claim: legacyClaim('Legacy', 'awarded', 'LEGACY_BADGE') }))

        const result = await claimAndSettlePendingBadgeCampaigns(['Legacy'])

        expect(result.transport).toBe('legacy')
        expect(result.claims[0]).toMatchObject({ outcome: 'awarded', badgeCode: 'LEGACY_BADGE' })
        expect(result.pending).toEqual([])
        expect(mockServerFetch).toHaveBeenNthCalledWith(2, '/badge/award', {
            method: 'POST',
            body: JSON.stringify({ campaignTag: 'Legacy' }),
        })
    })

    it('retains an unconfirmed legacy 200 instead of reporting false success', async () => {
        mockServerFetch
            .mockResolvedValueOnce(response(404, null))
            .mockResolvedValueOnce(response(200, { message: 'Badge awarded successfully' }))

        const result = await claimAndSettlePendingBadgeCampaigns(['Legacy'])

        expect(result.claims[0].outcome).toBe('legacy_response_unconfirmed')
        expect(result.pending).toEqual(['Legacy'])
    })

    it.each([
        [400, 'unknown', false],
        [404, 'retryable_error', true],
        [405, 'retryable_error', true],
        [408, 'retryable_error', true],
        [425, 'retryable_error', true],
        [500, 'retryable_error', true],
    ] as const)('settles legacy HTTP %s as %s', async (legacyStatus, outcome, remainsPending) => {
        mockServerFetch
            .mockResolvedValueOnce(response(404, null))
            .mockResolvedValueOnce(response(legacyStatus, { error: 'legacy failure' }))

        const result = await claimAndSettlePendingBadgeCampaigns(['Legacy'])

        expect(result.claims[0].outcome).toBe(outcome)
        expect(result.pending).toEqual(remainsPending ? ['Legacy'] : [])
    })

    it('computes pending identities without depending on backend echo casing', () => {
        expect(
            pendingBadgeCampaignsAfterClaims(
                ['First', 'Second'],
                [
                    { badgeCampaign: 'first', outcome: 'already_owned' },
                    { badgeCampaign: 'SECOND', outcome: 'definition_missing' },
                ]
            )
        ).toEqual(['Second'])
    })

    it('keeps validated acquisition navigation while dropping unknown policy and reward fields', async () => {
        mockServerFetch.mockResolvedValue(
            response(200, {
                claims: [
                    {
                        badgeCampaign: 'public-link',
                        badgeCode: 'PERMANENT_BADGE',
                        outcome: 'awarded',
                        capabilities: [{ key: 'card.flow.bypass', lifecycle: { kind: 'one_shot' } }],
                        acquisition: { fallback: 'normal_app', destination: 'offramp_migration' },
                        reward: { amount: 1000, currency: 'USD' },
                    },
                ],
            })
        )

        const result = await claimAndSettlePendingBadgeCampaigns(['public-link'])

        expect(result.claims).toEqual([
            {
                badgeCampaign: 'public-link',
                badgeCode: 'PERMANENT_BADGE',
                outcome: 'awarded',
                acquisition: { fallback: 'normal_app', destination: 'offramp_migration' },
            },
        ])
        expect(result.pending).toEqual([])
    })

    it('routes only a confirmed, validated acquisition destination', () => {
        const acquisition = { fallback: 'normal_app' as const, destination: 'offramp_migration' as const }

        expect(
            destinationForConfirmedBadgeCampaignAcquisition([
                { badgeCampaign: 'opaque', outcome: 'already_owned', acquisition },
            ])
        ).toBe('/add-money/crypto?network=EVM&source=offramp')
        expect(
            destinationForConfirmedBadgeCampaignAcquisition([
                { badgeCampaign: 'opaque', outcome: 'expired', acquisition },
            ])
        ).toBe('/home')
        expect(
            destinationForConfirmedBadgeCampaignAcquisition([{ badgeCampaign: 'offramp', outcome: 'awarded' }])
        ).toBe('/home')
    })

    it('drops a malformed destination while retaining the permanent award outcome', async () => {
        mockServerFetch.mockResolvedValue(
            response(200, {
                claims: [
                    {
                        badgeCampaign: 'offramp',
                        badgeCode: 'OFFRAMP_USER',
                        outcome: 'awarded',
                        acquisition: { fallback: 'normal_app', destination: 'https://attacker.example' },
                    },
                ],
            })
        )

        const result = await claimAndSettlePendingBadgeCampaigns(['offramp'])

        expect(result.claims).toEqual([{ badgeCampaign: 'offramp', badgeCode: 'OFFRAMP_USER', outcome: 'awarded' }])
        expect(destinationForConfirmedBadgeCampaignAcquisition(result.claims)).toBe('/home')
        expect(result.pending).toEqual([])
    })
})
