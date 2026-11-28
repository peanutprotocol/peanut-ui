'use client'

/**
 * The end of an external-wallet payment the API had not booked when the flow
 * stopped reading the charge (TASK-23856). It claims nothing: no "Sent", no
 * amount, no points. A deposit under the bridge minimum never leaves PENDING,
 * so a payer who sent too little ends here too, hence the support line.
 *
 * Composed like the deposit screen's alert card, with the success screen's exit.
 */

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { useFlowExit } from '@/features/payments/shared/hooks/useFlowExit'
import { useTranslations } from 'next-intl'

interface PaymentConfirmingViewProps {
    headerTitle: string
    redirectTo?: string
    onComplete?: () => void
}

export function PaymentConfirmingView({ headerTitle, redirectTo = '/home', onComplete }: PaymentConfirmingViewProps) {
    const t = useTranslations('payment')
    const tCommon = useTranslations('common')
    const handleDone = useFlowExit(redirectTo, onComplete)

    return (
        <PageStack>
            <NavHeader icon="cancel" title={headerTitle} onPrev={handleDone} />

            <PageStack.Center className="items-center gap-4">
                <Card>
                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        {/* the yellow clock is the wait, as on the processing drawers */}
                        <IconBubble icon="clock" size="s" color="yellow" />
                        <h1 className="text-center text-heading-card text-foreground-primary">
                            {t('confirmingPayment.title')}
                        </h1>
                        <p className="text-center text-body-s text-foreground-secondary">
                            {t('confirmingPayment.description')}
                        </p>
                    </div>
                </Card>

                <Button variant="primary" className="w-full" onClick={handleDone}>
                    {tCommon('done')}
                </Button>
            </PageStack.Center>
        </PageStack>
    )
}
