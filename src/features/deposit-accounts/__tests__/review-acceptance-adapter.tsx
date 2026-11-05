import React from 'react'
import { fireEvent, within } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { AccountsHubList } from '../components/AccountsHubList'
import { depositGateView } from '../depositGate'
import { corridorRecord, emptyCorridorRecord } from '../rails'
import type { ClaimableCorridor, DepositAccount } from '../types'
import type { GateState } from '@/utils/capability-gate'
import messages from '@/i18n/app/messages/en.json'

jest.mock('../useResidenceIso2s', () => ({ useResidenceIso2s: () => [] }))
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContextOptional: () => undefined,
    useModalsContext: () => ({ openSupportWithMessage: jest.fn() }),
}))

export async function bankScenario(options: { gateKind: string; blockedBy?: string; identityVerified?: boolean }) {
    const gate = { kind: options.gateKind } as GateState
    const claimable = {
        railId: 'bridge.sepa_eu',
        method: 'SEPA_EU',
        country: 'DE',
        currency: 'EUR',
        matching: { sender: 'unknown' },
        ...(options.blockedBy ? { blockedBy: options.blockedBy } : {}),
    } as ClaimableCorridor
    let destination: string | null = null
    const rendered = renderWithIntl(
        <AccountsHubList
            claimsEnabled
            bankRows={[]}
            onBankRowClick={() => {}}
            onChangeResidence={() => {}}
            accounts={{
                corridors: ['SEPA_EU'],
                accounts: emptyCorridorRecord<DepositAccount>(),
                gates: corridorRecord(() => gate),
                claimable: { ...emptyCorridorRecord<ClaimableCorridor>(), SEPA_EU: claimable },
                slotsHeld: 0,
                isLoading: false,
                isError: false,
                onRetry: () => {},
                onOpen: () => {
                    const action = depositGateView(gate, claimable).notice?.action
                    destination =
                        action === 'verify' ? 'action' : action === 'pending-review' ? 'review' : (action ?? null)
                },
            }}
        />
    )
    const row = rendered.container.querySelector('[data-testid="deposit-account-SEPA_EU"]') as HTMLElement
    const copy = messages.depositAccounts.list
    const text = within(row)
    const badge = text.queryByText(copy.badgeActionNeeded)
        ? 'action-needed'
        : text.queryByText(copy.badgeUnderReview)
          ? 'under-review'
          : text.queryByText(copy.badgeVerifyId)
            ? 'verify-id'
            : null
    fireEvent.click(row)
    rendered.unmount()
    return { badge, destination }
}
