'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { useAuth } from '@/context/authContext'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { type FC } from 'react'

interface ClaimedViewProps {
    amount: number | bigint
    senderUsername?: string | null
}

export const ClaimedView: FC<ClaimedViewProps> = ({ amount, senderUsername }) => {
    const { user } = useAuth()
    const router = useRouter()
    const t = useTranslations('claim')

    return (
        <PageStack>
            <NavHeader title={t('receive')} />
            <PageStack.Center className="gap-4">
                <Card className="space-y-4 p-6">
                    <div className="flex items-center justify-center">
                        <IconBubble icon="info" size="s" color="yellow" />
                    </div>
                    <div className="space-y-2 text-center">
                        <h1 className="text-heading-card text-foreground-primary">{t('claimed.title')}</h1>
                        <p className="text-body-s text-foreground-secondary">
                            {senderUsername
                                ? t.rich('claimed.descriptionWithSender', {
                                      amount: String(amount),
                                      sender: senderUsername,
                                      b: (chunks) => <span className="font-bold">{chunks}</span>,
                                  })
                                : t.rich('claimed.description', {
                                      amount: String(amount),
                                      b: (chunks) => <span className="font-bold">{chunks}</span>,
                                  })}
                        </p>
                        {!user && (
                            <p className="text-body-s text-foreground-secondary">{t('claimed.createWalletHint')}</p>
                        )}
                    </div>
                </Card>
                <Button
                    variant="purple"
                    shadowSize="4"
                    className="w-full"
                    onClick={() => router.push(user ? '/home' : '/setup')}
                >
                    {user ? t('backToHome') : t('claimed.getStarted')}
                </Button>
            </PageStack.Center>
        </PageStack>
    )
}
