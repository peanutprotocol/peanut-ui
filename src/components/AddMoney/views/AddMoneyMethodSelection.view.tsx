'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Section } from '@/components/0_Bruddle/Section'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import ChooseNetworkDrawer from '../components/ChooseNetworkDrawer'
import type { RhinoChainType } from '@/services/services.types'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
interface AddMoneyMethodSelectionProps {
    onBankTransferClick: () => void
}

const AddMoneyMethodSelection = ({ onBankTransferClick }: AddMoneyMethodSelectionProps) => {
    const router = useRouter()
    const t = useTranslations('addMoney')
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    const handleNetworkSelect = (network: RhinoChainType) => {
        setIsDrawerOpen(false)
        router.push(`/add-money/crypto?network=${network}`)
    }

    return (
        <>
            <Section title={t('howWouldYouLikeToAdd')}>
                <ListGroup>
                    <ListItem
                        title={t('methods.crypto')}
                        body={<div>{t('methods.cryptoDescription')}</div>}
                        chevron
                        leading={
                            <AvatarWithBadge
                                icon="wallet-outline"
                                size="extra-small"
                                className="bg-background-icon-bubble-blue"
                            />
                        }
                        onClick={() => setIsDrawerOpen(true)}
                    />
                    <ListItem
                        title={t('methods.bankTransfer')}
                        body={<div>{t('methods.kycRequired')}</div>}
                        chevron
                        leading={
                            <AvatarWithBadge
                                icon="bank"
                                size="extra-small"
                                className="bg-background-icon-bubble-blue"
                                inlineStyle={{ color: 'black' }}
                            />
                        }
                        onClick={onBankTransferClick}
                    />
                </ListGroup>
            </Section>

            <ChooseNetworkDrawer
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onSelect={handleNetworkSelect}
            />
        </>
    )
}

export default AddMoneyMethodSelection
