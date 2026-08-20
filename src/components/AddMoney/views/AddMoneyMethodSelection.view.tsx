'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import ChooseNetworkDrawer from '../components/ChooseNetworkDrawer'
import type { RhinoChainType } from '@/services/services.types'
import { useAuth } from '@/context/authContext'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { OFFRAMP_MIGRATION_ROUTE } from '@/services/acquisition-navigation'

const OFFRAMP_BADGE_CODE = 'OFFRAMP_USER'

interface AddMoneyMethodSelectionProps {
    onBankTransferClick: () => void
}

const AddMoneyMethodSelection = ({ onBankTransferClick }: AddMoneyMethodSelectionProps) => {
    const router = useRouter()
    const { user } = useAuth()
    const t = useTranslations('addMoney')
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    // Existing OFFRAMP_USER possession carries the migration entry. Acquisition
    // provenance is audit-only and must not weaken this established benefit.
    const hasOfframpMigrationEntry = user?.user?.badges?.some((badge) => badge.code === OFFRAMP_BADGE_CODE) ?? false

    const handleNetworkSelect = (network: RhinoChainType) => {
        setIsDrawerOpen(false)
        router.push(`/add-money/crypto?network=${network}`)
    }

    return (
        <>
            <div className="flex flex-col gap-2">
                <h2 className="text-heading-card text-foreground-primary">{t('howWouldYouLikeToAdd')}</h2>
                <div className="flex flex-col">
                    {hasOfframpMigrationEntry && (
                        <ListItem
                            title={t('methods.migrateFromOfframp')}
                            body={<div>{t('methods.migrateFromOfframpDescription')}</div>}
                            position="first"
                            chevron
                            leading={
                                <AvatarWithBadge
                                    icon="wallet-outline"
                                    size="extra-small"
                                    className="bg-background-icon-bubble-yellow"
                                />
                            }
                            onClick={() => router.push(OFFRAMP_MIGRATION_ROUTE)}
                        />
                    )}
                    <ListItem
                        title={t('methods.crypto')}
                        body={<div>{t('methods.cryptoDescription')}</div>}
                        position={hasOfframpMigrationEntry ? 'middle' : 'first'}
                        chevron
                        leading={
                            <AvatarWithBadge
                                icon="wallet-outline"
                                size="extra-small"
                                className="bg-background-icon-bubble-yellow"
                            />
                        }
                        onClick={() => setIsDrawerOpen(true)}
                    />
                    <ListItem
                        title={t('methods.bankTransfer')}
                        body={<div>{t('methods.kycRequired')}</div>}
                        position="last"
                        chevron
                        leading={
                            <AvatarWithBadge
                                icon="bank"
                                size="extra-small"
                                className="bg-background-icon-bubble-yellow"
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
