'use client'

import { ActionListCard } from '@/components/ActionListCard'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import ChooseNetworkDrawer from '../components/ChooseNetworkDrawer'
// offramp.xyz migrants get this link-granted badge at signup (peanut-api-ts
// invite/badge routes, code `offramp` / utm `offramp`).
import { OFFRAMP_BADGE_CODE } from '@/components/Invites/campaign-maps'
import type { RhinoChainType } from '@/services/services.types'
import { useAuth } from '@/context/authContext'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface AddMoneyMethodSelectionProps {
    onBankTransferClick: () => void
}

const AddMoneyMethodSelection = ({ onBankTransferClick }: AddMoneyMethodSelectionProps) => {
    const router = useRouter()
    const { user } = useAuth()
    const t = useTranslations('addMoney')
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    // offramp migrants get a tailored, de-cluttered arbitrum deposit entry
    const hasOfframpBadge = user?.user?.badges?.some((b) => b.code === OFFRAMP_BADGE_CODE) ?? false

    const handleNetworkSelect = (network: RhinoChainType) => {
        setIsDrawerOpen(false)
        router.push(`/add-money/crypto?network=${network}`)
    }

    return (
        <>
            <div className="flex flex-col gap-2">
                <h2 className="text-base font-bold">{t('howWouldYouLikeToAdd')}</h2>
                <div className="flex flex-col">
                    {hasOfframpBadge && (
                        <ActionListCard
                            title={t('methods.migrateFromOfframp')}
                            description={t('methods.migrateFromOfframpDescription')}
                            position="first"
                            leftIcon={
                                <AvatarWithBadge icon="wallet-outline" size="extra-small" className="bg-yellow-1" />
                            }
                            onClick={() => router.push('/add-money/crypto?network=EVM&source=offramp')}
                        />
                    )}
                    <ActionListCard
                        title={t('methods.crypto')}
                        description={t('methods.cryptoDescription')}
                        position={hasOfframpBadge ? 'middle' : 'first'}
                        leftIcon={<AvatarWithBadge icon="wallet-outline" size="extra-small" className="bg-yellow-1" />}
                        onClick={() => setIsDrawerOpen(true)}
                    />
                    <ActionListCard
                        title={t('methods.bankTransfer')}
                        description={t('methods.kycRequired')}
                        position="last"
                        leftIcon={
                            <AvatarWithBadge
                                icon="bank"
                                size="extra-small"
                                className="bg-yellow-1"
                                inlineStyle={{ color: 'black' }}
                            />
                        }
                        onClick={onBankTransferClick}
                    />
                </div>
            </div>

            <ChooseNetworkDrawer
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onSelect={handleNetworkSelect}
            />
        </>
    )
}

export default AddMoneyMethodSelection
