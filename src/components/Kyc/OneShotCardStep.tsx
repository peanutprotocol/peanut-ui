'use client'

import CardTermsScreen from '@/components/Card/CardTermsScreen'
import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import type { OneShotCardChain } from '@/hooks/useOneShotCardChain'

/**
 * The screens of the card step in one-shot onboarding (TASK-23329, item 9b):
 * the SDK on the card questions (or a missing identity step), and the
 * cardholder agreements in a drawer. The card page shows the same two, from
 * its own flow; here they run beside the identity check and hand back to the
 * setup drawer. Whoever renders this hides the setup drawer while
 * `step.isForeground`: a drawer and the SDK's modal cannot share the screen.
 */
export const OneShotCardStep = ({ step }: { step: OneShotCardChain }) => {
    const agreements = step.chain?.kind === 'agreements' ? step.chain : null
    return (
        <>
            <SumsubKycWrapper
                visible={!!step.token}
                accessToken={step.token}
                onClose={step.handleSdkClose}
                onComplete={step.handleSdkComplete}
                onRefreshToken={step.refreshToken}
                isMultiLevel={false}
            />
            <Drawer
                open={!!agreements && step.showTerms}
                onOpenChange={(open) => {
                    if (!open) step.dismissTerms()
                }}
                dismissible={!step.isBusy}
            >
                <DrawerContent>
                    <div className="pt-1 pb-6" data-testid="one-shot-card-terms">
                        <CardTermsScreen
                            isUsResident={agreements?.isUsResident ?? false}
                            onAccept={step.acceptTerms}
                            onPrev={step.dismissTerms}
                            inDrawer
                        />
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    )
}
