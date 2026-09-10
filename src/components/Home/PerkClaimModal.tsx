'use client'

import { type PendingPerk } from '@/services/perks'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import { usePerkClaimFlow } from './usePerkClaimFlow'
import { PerkClaimSuccessModal } from './PerkClaimSuccessModal'
import { PerkClaimGiftBox } from './PerkClaimGiftBox'

interface PerkClaimModalProps {
    perk: PendingPerk
    visible: boolean
    onClose: () => void
    onClaimed: (perkId: string) => void
    /** The share CTA's invite drawer lives in the HOST (which outlives this
     *  tree): the success sheet unmounts 400ms after dismissal, so a drawer
     *  mounted here would die mid-open. */
    onShareInvite?: () => void
}

/**
 * Drawer for claiming perks with gift box animation.
 * Contains the shake/hold interaction, confetti, and success state.
 */
function PerkClaimModal({ perk, visible, onClose, onClaimed, onShareInvite }: PerkClaimModalProps) {
    const t = useAppTranslations('home.perk')
    const { claimPhase, lastClaimedPerk, isSuccessPhase, handleHoldComplete, handleDismissSuccess, handleModalClose } =
        usePerkClaimFlow({ perk, visible, onClose, onClaimed })

    if (!visible) return null

    // The success phase renders its own sheet, the gift box phase this one
    if (isSuccessPhase) {
        return (
            <PerkClaimSuccessModal
                perk={lastClaimedPerk!}
                claimPhase={claimPhase}
                onClose={handleModalClose}
                onDismiss={handleDismissSuccess}
                onShareInvite={onShareInvite}
            />
        )
    }

    return (
        <Drawer
            open={visible}
            // an opening gift must not be abandoned mid-animation
            dismissible={claimPhase !== 'opening'}
            onOpenChange={(open) => {
                if (!open && claimPhase !== 'opening') handleModalClose()
            }}
        >
            <DrawerContent accessibleTitle={t('holdToUnwrap')}>
                {/* data-vaul-no-drag: the shake/hold gift gesture must not start a drawer drag */}
                <div className="flex flex-col items-center pt-1 pb-6 text-center" data-vaul-no-drag>
                    <PerkClaimGiftBox perk={perk} onHoldComplete={handleHoldComplete} claimPhase={claimPhase} />
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default PerkClaimModal
