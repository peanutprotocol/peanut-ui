'use client'

/**
 * What a pot payer sees when an external-wallet deposit arrived short of
 * their charge (TASK-23856). It used to read "Sent $58.51" whatever arrived.
 *
 * It states what the charge booked, what is still needed, and the same
 * deposit address: a second transfer to that address books on the same
 * charge. Composed like the deposit screen's "market moved" state (alert card,
 * then the address) with the success screen's exit.
 */

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Card from '@/components/Global/Card'
import CopyField from '@/components/Global/CopyField'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { useAuth } from '@/context/authContext'
import { useReturnTo } from '@/hooks/useSafeBack'
import { formatBankAmount } from '@/utils/currency'
import { useTranslations } from 'next-intl'

interface ContributePotPartialViewProps {
    headerTitle: string
    /** What the charge booked, in dollars. */
    received: string
    /** What the charge asked, in dollars. */
    asked: string
    /** The address the payer sent to; absent when the flow lost it. */
    depositAddress?: string | null
    redirectTo?: string
    onComplete?: () => void
}

export function ContributePotPartialView({
    headerTitle,
    received,
    asked,
    depositAddress,
    redirectTo = '/home',
    onComplete,
}: ContributePotPartialViewProps) {
    const t = useTranslations('payment')
    const tCommon = useTranslations('common')
    const { user } = useAuth()
    const remaining = Math.max(Number(asked) - Number(received), 0)

    // the success screen's exit: back past the flow, never into it again
    const leaveFlow = useReturnTo(user?.user.userId ? redirectTo : '/setup')
    const handleDone = () => {
        leaveFlow()
        onComplete?.()
    }

    return (
        <PageStack>
            <NavHeader icon="cancel" title={headerTitle} onPrev={handleDone} />

            <PageStack.Center className="items-center gap-4">
                <Card>
                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        <IconBubble icon="alert" size="s" color="yellow" />
                        <h1 className="text-center text-heading-card text-foreground-primary">
                            {t('partialContribution.title', {
                                received: formatBankAmount(received, 'USD'),
                                asked: formatBankAmount(asked, 'USD'),
                            })}
                        </h1>
                        <p className="text-center text-body-s text-foreground-secondary">
                            {t('partialContribution.description', { remaining: formatBankAmount(remaining, 'USD') })}
                        </p>
                    </div>
                </Card>

                {depositAddress && (
                    <>
                        <div className="flex items-center justify-center">
                            <QRCodeWrapper url={depositAddress} />
                        </div>
                        <CopyField text={depositAddress} />
                    </>
                )}

                <Button variant="primary" className="w-full" onClick={handleDone}>
                    {tCommon('done')}
                </Button>
            </PageStack.Center>
        </PageStack>
    )
}
