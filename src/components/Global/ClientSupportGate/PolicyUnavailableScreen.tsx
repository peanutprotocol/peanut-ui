'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'

/**
 * No policy has ever been validated on this device and the live read failed
 * (offline, blocked, or malformed). The wallet tree cannot mount without a
 * verdict, so the screen asks for a retry. Same anatomy as OfflineScreen;
 * nothing here touches the API or the wallet providers.
 */
export function PolicyUnavailableScreen({ checking, onRetry }: { checking: boolean; onRetry: () => void }) {
    const t = useTranslations('clientSupport')
    const tCommon = useTranslations('common')

    return (
        <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 bg-background-page p-6">
            <IconBubble icon="retry" size="l" color="gray" />
            <TitleBlock align="center" size="s" title={t('unavailableTitle')} description={t('unavailable')} />
            <div className="flex w-full max-w-md flex-col gap-4">
                <Button
                    variant="purple"
                    className="w-full"
                    icon="retry"
                    loading={checking}
                    disabled={checking}
                    onClick={onRetry}
                >
                    {tCommon('tryAgain')}
                </Button>
            </div>
        </main>
    )
}
