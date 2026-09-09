'use client'

import { type PendingPerk } from '@/services/perks'
import ActionModal from '@/components/Global/ActionModal'
import { usePerkClaimFlow } from './usePerkClaimFlow'
import { PerkClaimSuccessModal } from './PerkClaimSuccessModal'
import { PerkClaimGiftBox } from './PerkClaimGiftBox'

interface PerkClaimModalProps {
    perk: PendingPerk
    visible: boolean
    onClose: () => void
    onClaimed: (perkId: string) => void
}

/**
 * Modal for claiming perks with gift box animation.
 * Contains the shake/hold interaction, confetti, and success state.
 * Uses ActionModal for consistent styling with other modals.
 */
function PerkClaimModal({ perk, visible, onClose, onClaimed }: PerkClaimModalProps) {
    const { claimPhase, lastClaimedPerk, isSuccessPhase, handleHoldComplete, handleDismissSuccess, handleModalClose } =
        usePerkClaimFlow({ perk, visible, onClose, onClaimed })

    if (!visible) return null

    // Use ActionModal's native props for success phase, custom content for gift box phase
    if (isSuccessPhase) {
        return (
            <PerkClaimSuccessModal
                perk={lastClaimedPerk!}
                claimPhase={claimPhase}
                onClose={handleModalClose}
                onDismiss={handleDismissSuccess}
            />
        )
    }

    return (
        <ActionModal
            visible={visible}
            onClose={handleModalClose}
            title=""
            preventClose={claimPhase === 'opening'}
            content={<PerkClaimGiftBox perk={perk} onHoldComplete={handleHoldComplete} claimPhase={claimPhase} />}
        />
    )
}

export default PerkClaimModal
