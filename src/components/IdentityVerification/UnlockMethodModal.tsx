'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import KycPrepChecklist, { type KycPrepPath } from '@/components/Kyc/KycPrepChecklist'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import type { KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import { useBridgeProviderId } from '@/hooks/useBridgeProviderId'
import { ProviderNote } from '@/components/Provider/ProviderNote'
import { providerForRegionIntent } from '@/utils/regions.utils'

interface UnlockMethodModalProps {
    visible: boolean
    onClose: () => void
    onUnlock: () => void
    /** Display label of the tapped method row (already localized). */
    methodLabel: string | null
    /** Which prep checklist applies: extended for Manteca (BR/AR), standard elsewhere. */
    path?: KycPrepPath
    isLoading?: boolean
    /** the tapped row's region and ISO2 country, to name the account provider */
    regionIntent?: KYCRegionIntent
    country?: string | null
}

/**
 * Method-worded unlock sheet for the Unlock payments screen. The tap promised
 * a product ("Euro bank transfers · Unlock"), so the sheet speaks about that
 * product — never about regions. The body is the prep checklist: what to have
 * ready, stated BEFORE the SDK opens, so nobody starts
 * the check and then goes hunting for documents halfway through.
 */
const UnlockMethodModal = ({
    visible,
    onClose,
    onUnlock,
    methodLabel,
    path = 'standard',
    isLoading,
    regionIntent,
    country,
}: UnlockMethodModalProps) => {
    const t = useTranslations('profile.unlockPayments.unlockModal')
    const tPrep = useTranslations('kyc.prep')
    const tCommon = useTranslations('common')
    const bridgeProviderId = useBridgeProviderId()
    const provider = providerForRegionIntent(regionIntent)
    const providerId =
        provider === 'bridge'
            ? bridgeProviderId
            : provider === 'manteca' && country === 'AR'
              ? 'manteca-ar'
              : provider === 'manteca' && country === 'BR'
                ? 'manteca-br'
                : null

    return (
        <Drawer
            open={visible}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="shield" color="blue" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>
                                {methodLabel ? t('title', { method: methodLabel }) : t('titleGeneric')}
                            </DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col items-center gap-4">
                        {/* the checklist is the body — left-aligned like the modal's descriptionClassName override */}
                        <div className="w-full text-left">
                            <KycPrepChecklist path={path} />
                        </div>
                        <Button
                            icon="check-circle"
                            shadowSize="4"
                            variant="primary"
                            className="w-full justify-center"
                            disabled={isLoading}
                            onClick={onUnlock}
                        >
                            {isLoading ? tCommon('loading') : tPrep('startCta')}
                        </Button>
                        {/* one footnote under the button: who receives the id, and that peanut keeps no copy */}
                        {providerId ? (
                            <ProviderNote providerId={providerId} nested prospective idCheck />
                        ) : (
                            <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
                        )}
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default UnlockMethodModal
