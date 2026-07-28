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
                    <div className="flex size-8 items-center justify-center rounded-full bg-[#FFCC00]">
                        <Icon name="info" size={16} />
                    </div>
                </Card.Title>
                <Card.Description className="mx-auto font-medium text-black">{t('claimed.title')}</Card.Description>
            </Card.Header>

            <Card.Content className="mx-auto flex flex-col gap-2 space-y-4 pb-8">
                <p className="text-center text-grey-1">
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

                {!user && <p className="text-center text-sm text-grey-1">{t('claimed.createWalletHint')}</p>}

                <Button
                    onClick={() => {
                        if (user) {
                            router.push('/home')
                        } else {
                            router.push('/setup')
                        }
                    }}
                    shadowSize="4"
                    className="text-sm md:text-base"
                >
                    {user ? t('backToHome') : t('claimed.getStarted')}
                </Button>
            </Card.Content>
        </Card>
    )
}
