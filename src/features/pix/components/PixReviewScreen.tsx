'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import NavHeader from '@/components/Global/NavHeader'
import { useAuth } from '@/context/authContext'
import { useReturnTo } from '@/hooks/useSafeBack'

/**
 * The wait while the Pix provider reviews the user, for every provider's route: a static screen with
 * no loader, since a push says when Pix is ready (Aleks, 13 Nov). "Done" leaves to Home. A user who
 * stays still sees the next state: the capabilities are read again when the page comes back into view,
 * and the Pix setup shows whatever the route says then.
 */
export function PixReviewScreen({ title, onBack }: { title: string; onBack: () => void }) {
    const t = useTranslations('pix.setup')
    const tCommon = useTranslations('common')
    const { fetchUser } = useAuth()
    const leaveToHome = useReturnTo('/home')
    useEffect(() => {
        const readAgain = () => {
            if (document.visibilityState === 'visible') void fetchUser().catch(() => undefined)
        }
        window.addEventListener('focus', readAgain)
        document.addEventListener('visibilitychange', readAgain)
        return () => {
            window.removeEventListener('focus', readAgain)
            document.removeEventListener('visibilitychange', readAgain)
        }
    }, [fetchUser])

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <PageStack.Center>
                <div className="flex flex-col items-center gap-4 text-center">
                    {/* waiting on the provider: the yellow clock (design.md, icon bubble colour) */}
                    <IconBubble icon="clock" color="yellow" size="l" />
                    <TitleBlock align="center" title={t('reviewingTitle')} description={t('reviewing')} />
                </div>
                <Button variant="primary" className="w-full" onClick={leaveToHome}>
                    {tCommon('done')}
                </Button>
            </PageStack.Center>
        </PageStack>
    )
}
