/**
 * handlePayment stores the charge before the on-chain send. The recipient used
 * to be rebuilt from the charge as a bare ADDRESS, so the pay card and the
 * success screen showed a shortened 0x address instead of the name in the URL.
 */
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { personFrom } from '@/lib/person/person'
import type { ParsedURL } from '@/lib/url-parser/types/payment'
import type { TRequestChargeResponse } from '@/services/services.types'
import { SemanticRequestFlowProvider, useSemanticRequestFlowContext } from '../SemanticRequestFlowContext'

// One address in the two casings the app meets: lowercase from the resolver,
// EIP-55 checksum from the API.
const ALICE_ADDRESS_LOWER = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
const ALICE_ADDRESS_CHECKSUM = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222'

const chargeTo = (recipientAddress: string) =>
    ({ uuid: 'charge-1', requestLink: { recipientAddress } }) as unknown as TRequestChargeResponse

const alice = personFrom({ userId: 'u-alice', username: 'alice', avatarKey: 'basic.cloud' })

const usernameUrl: ParsedURL = {
    recipient: { identifier: 'alice', recipientType: 'USERNAME', resolvedAddress: ALICE_ADDRESS_LOWER, person: alice },
    amount: '2',
    token: undefined,
    chain: undefined,
}

const renderContext = (parsedUrl: ParsedURL) =>
    renderHook(() => useSemanticRequestFlowContext(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <SemanticRequestFlowProvider initialParsedUrl={parsedUrl}>{children}</SemanticRequestFlowProvider>
        ),
    })

describe('SemanticRequestFlowContext recipient identity through the send lifecycle', () => {
    it('keeps the username once the charge for that same address exists, with the charge address', () => {
        const { result } = renderContext(usernameUrl)
        expect(result.current.recipient).toMatchObject({ identifier: 'alice', recipientType: 'USERNAME' })

        act(() => result.current.setCharge(chargeTo(ALICE_ADDRESS_CHECKSUM)))

        expect(result.current.recipient).toEqual({
            identifier: 'alice',
            recipientType: 'USERNAME',
            resolvedAddress: ALICE_ADDRESS_CHECKSUM,
            person: alice,
        })
    })

    it('keeps an ENS name the same way', () => {
        const { result } = renderContext({
            ...usernameUrl,
            recipient: {
                identifier: 'alice.eth',
                recipientType: 'ENS',
                resolvedAddress: ALICE_ADDRESS_LOWER,
                person: null,
            },
        })
        act(() => result.current.setCharge(chargeTo(ALICE_ADDRESS_CHECKSUM)))

        expect(result.current.recipient).toEqual({
            identifier: 'alice.eth',
            recipientType: 'ENS',
            resolvedAddress: ALICE_ADDRESS_CHECKSUM,
            person: null,
        })
    })

    it('falls back to the charge address when the URL names someone else', () => {
        const { result } = renderContext(usernameUrl)
        act(() => result.current.setCharge(chargeTo(OTHER_ADDRESS)))

        expect(result.current.recipient).toEqual({
            identifier: OTHER_ADDRESS,
            recipientType: 'ADDRESS',
            resolvedAddress: OTHER_ADDRESS,
            person: null,
        })
    })

    it('falls back to the charge address when the URL names nobody (chargeId-only link)', () => {
        const { result } = renderContext({ recipient: null, amount: undefined, token: undefined, chain: undefined })
        expect(result.current.recipient).toBeNull()

        act(() => result.current.setCharge(chargeTo(OTHER_ADDRESS)))

        expect(result.current.recipient).toEqual({
            identifier: OTHER_ADDRESS,
            recipientType: 'ADDRESS',
            resolvedAddress: OTHER_ADDRESS,
            person: null,
        })
    })

    it('returns to the URL identity when the charge is cleared (back from confirm)', () => {
        const { result } = renderContext(usernameUrl)
        act(() => result.current.setCharge(chargeTo(OTHER_ADDRESS)))
        act(() => result.current.setCharge(null))

        expect(result.current.recipient).toMatchObject({ identifier: 'alice', recipientType: 'USERNAME' })
    })
})
