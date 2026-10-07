'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import KycPrepChecklist, { type KycPrepPath } from '@/components/Kyc/KycPrepChecklist'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import type { KycIntentKey } from '@/services/kyc-intents'
import { type AddDone, UnlockMethodAddStep } from './UnlockMethodAddStep'
import { UnlockMethodOneShotStep } from './UnlockMethodOneShotStep'

interface UnlockMethodModalProps {
    visible: boolean
    onClose: () => void
    onUnlock: () => void
    /** Display label of the tapped method row (already localized). */
    methodLabel: string | null
    /** Which prep checklist applies: extended for Manteca (BR/AR), standard elsewhere. */
    path?: KycPrepPath
    isLoading?: boolean
    /**
     * One-shot onboarding (TASK-23329): the declared residence and the feature
     * the tapped method stands for. Before the identity check the sheet asks
     * which ID the user will show and stores the feature before the check
     * starts; once the check is passed (`verified`) it adds the feature to the
     * stored set with no new check (D16). Absent is today's sheet.
     */
    oneShot?: { residence: string; feature: KycIntentKey; verified?: boolean } | null
    /** The verified sheet's answer: the method is on, or is being set up. */
    onOneShotDone?: (outcome: AddDone) => void
    /** The verified sheet's "Verify again with a {country} ID". */
    onOneShotVerifyAgain?: () => void
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
    oneShot,
    onOneShotDone,
    onOneShotVerifyAgain,
}: UnlockMethodModalProps) => {
    const t = useTranslations('profile.unlockPayments.unlockModal')
    const tPrep = useTranslations('kyc.prep')
    const tCommon = useTranslations('common')
    const [oneShotSaving, setOneShotSaving] = useState(false)

    return (
        <Drawer
            open={visible}
            // the one-shot step's save must not be abandoned by a swipe or an
            // overlay tap: its answer would start the check on a closed sheet
            dismissible={!oneShotSaving}
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
                        {oneShot?.verified ? (
                            <UnlockMethodAddStep
                                residence={oneShot.residence}
                                feature={oneShot.feature}
                                methodLabel={methodLabel}
                                onDone={(outcome) => onOneShotDone?.(outcome)}
                                onVerifyAgain={() => onOneShotVerifyAgain?.()}
                                onSavingChange={setOneShotSaving}
                            />
                        ) : oneShot ? (
                            <UnlockMethodOneShotStep
                                residence={oneShot.residence}
                                feature={oneShot.feature}
                                methodLabel={methodLabel}
                                path={path}
                                isLoading={!!isLoading}
                                onUnlock={onUnlock}
                                onSavingChange={setOneShotSaving}
                            />
                        ) : (
                            <>
                                {/* the checklist is the body — left-aligned like the modal's descriptionClassName override */}
                                <div className="w-full text-left">
                                    <KycPrepChecklist path={path} />
                                </div>
                                <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
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
                            </>
                        )}
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default UnlockMethodModal
