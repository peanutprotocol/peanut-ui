/**
 * InitialClaimLinkView — legacy campaign-wire precedence (chip finding on
 * TASK-21854 cbb96c0)
 *
 * The view must resolve campaignTag from the LIVE url-ordered search params
 * (badgeCampaignForLegacyWire over useSearchParams) and hand it to
 * useInitialClaimFlow — that tag decides which badge campaign a claim is
 * attributed to. An intermediate extraction rebuilt the params in fixed
 * insertion order, which flipped precedence when both legacy keys were
 * present and dropped duplicate keys. Pin the wiring, not the helper (the
 * helper has its own suite in badge-campaign-context.test.ts).
 */
import React from 'react'
import { render } from '@testing-library/react'
import { InitialClaimLinkView } from '../Initial.view'
import { useInitialClaimFlow } from '../useInitialClaimFlow'
import type { IClaimScreenProps } from '../../Claim.consts'

let urlSearch = ''
jest.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(urlSearch),
}))

// stub the flow hook: claimBankFlowStep truthy makes the view early-return
// into the (mocked) bank flow, so the render stays minimal while the
// view->hook wiring still runs for real
jest.mock('../useInitialClaimFlow', () => ({
    useInitialClaimFlow: jest.fn(() => ({ claimBankFlowStep: 'transfer' })),
}))
jest.mock('../views/BankFlowManager.view', () => ({ BankFlowManager: () => null }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
        const { priority, fill, ...rest } = props
        return <img alt="" {...rest} />
    },
}))

const mockedFlow = useInitialClaimFlow as jest.Mock

const props = { claimLinkData: {} } as unknown as IClaimScreenProps

describe('InitialClaimLinkView campaign wire', () => {
    beforeEach(() => {
        mockedFlow.mockClear()
    })

    it('url order wins when both legacy keys are present, not insertion order', () => {
        urlSearch = 'campaignTag=b&campaign=a'
        render(<InitialClaimLinkView {...props} />)
        // the fixed-insertion-order shim resolved 'a' here; url order says 'b'
        expect(mockedFlow).toHaveBeenCalledWith(expect.anything(), 'b')
    })

    it('duplicate legacy keys are not dropped — first url occurrence wins', () => {
        urlSearch = 'campaign=a&campaign=b'
        render(<InitialClaimLinkView {...props} />)
        expect(mockedFlow).toHaveBeenCalledWith(expect.anything(), 'a')
    })

    it('no campaign params on the url forwards undefined', () => {
        urlSearch = ''
        render(<InitialClaimLinkView {...props} />)
        expect(mockedFlow).toHaveBeenCalledWith(expect.anything(), undefined)
    })
})
