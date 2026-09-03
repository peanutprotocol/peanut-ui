'use client'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type FC } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'

interface ClaimedViewProps {
    amount: number | bigint
    senderUsername?: string | null
}

export const ClaimedView: FC<ClaimedViewProps> = ({ amount, senderUsername }) => {
    const { user } = useAuth()
    const router = useRouter()
    const t = useTranslations('claim')

    return (
        <Card className="shadow-none sm:shadow-4">
            <Card.Header className="space-y-2 border-0">
                <Card.Title className="mx-auto">
                    {/* drift fix: was off-token #FFCC00 — snapped to the DS yellow */}
                    <div className="flex size-8 items-center justify-center rounded-full bg-background-icon-bubble-yellow">
                        <Icon name="info" size={16} />
                    </div>
                </Card.Title>
                <Card.Description className="mx-auto font-medium text-foreground-primary">
                    {t('claimed.title')}
                </Card.Description>
            </Card.Header>

            <Card.Content className="mx-auto space-y-4 flex flex-col gap-2 pb-8">
                <p className="text-center text-foreground-secondary">
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
                    <p className="text-center text-body-s text-foreground-secondary">{t('claimed.createWalletHint')}</p>
                )}

                <Button
                    onClick={() => {
                        if (user) {
                            router.push('/home')
                        } else {
                            router.push('/setup')
                        }
                    }}
                    shadowSize="4"
                    className="text-body-s md:text-body-m"
                >
                    {user ? t('backToHome') : t('claimed.getStarted')}
                </Button>
            </Card.Content>
        </Card>
    )
}
