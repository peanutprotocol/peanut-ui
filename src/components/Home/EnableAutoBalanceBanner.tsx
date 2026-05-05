'use client'

import ActionModal from '@/components/Global/ActionModal'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'

/**
 * Blocking modal shown when the user holds an ACTIVE Rain card without
 * the one-tap session-key grant. Without it auto-balance silently no-ops
 * after every deposit and the first card spend would force the grant
 * inline anyway — surfacing it up-front avoids both surprises.
 *
 * Same preconditions `useGrantSessionKey().grant()` enforces (collateral
 * proxy + coordinator already provisioned by Rain) — otherwise the
 * passkey tap would throw `no-contracts`.
 *
 * Non-dismissible by design: no close button, no backdrop dismiss. The
 * modal hides itself once `grant()` succeeds and the overview refetch
 * flips `hasWithdrawApproval` to true.
 */
export default function EnableAutoBalanceBanner() {
    const { overview } = useRainCardOverview()
    const { grant, isGranting } = useGrantSessionKey()

    const card = overview?.cards?.[0]
    const shouldShow =
        card?.status === 'ACTIVE' &&
        !card.hasWithdrawApproval &&
        !!overview?.status?.contractAddress &&
        !!overview?.status?.coordinatorAddress

    return (
        <ActionModal
            visible={shouldShow}
            onClose={() => {}}
            preventClose
            hideModalCloseButton
            icon="credit-card"
            iconContainerClassName="bg-yellow-1"
            title="Finish setting up your card"
            description="One passkey tap to start using your card."
            ctas={[
                {
                    text: isGranting ? 'Working…' : 'Continue',
                    variant: 'purple',
                    shadowSize: '4',
                    disabled: isGranting,
                    onClick: () => {
                        void grant()
                    },
                },
            ]}
        />
    )
}
