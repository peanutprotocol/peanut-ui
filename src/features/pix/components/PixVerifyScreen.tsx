'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import NavHeader from '@/components/Global/NavHeader'
import { markVerifySource } from '@/features/paperwork-verification/verifySource'

/** Pix needs the identity check first: a tap opens /verify, and Back from there returns here, never into a redirect. */
export function PixVerifyScreen({ title, onBack }: { title: string; onBack: () => void }) {
    const t = useTranslations('pix.setup')
    const router = useRouter()
    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <PageStack.Center>
                <div className="flex flex-col items-center gap-4 text-center">
                    <IconBubble {...CONCEPT_ICONS.verification} size="l" />
                    <TitleBlock align="center" title={t('title')} />
                </div>
                <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => {
                        markVerifySource('unlock_payments')
                        router.push('/verify')
                    }}
                >
                    {t('verifyCta')}
                </Button>
            </PageStack.Center>
        </PageStack>
    )
}
