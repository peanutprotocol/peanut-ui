'use client'

import { ActionListCard } from '@/components/ActionListCard'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import ChooseNetworkDrawer from '../components/ChooseNetworkDrawer'
import type { RhinoChainType } from '@/services/services.types'
import { useAuth } from '@/context/authContext'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// offramp.xyz migrants get this link-granted badge at signup (peanut-api-ts
// invite/badge routes, code `offramp` / utm `offramp`). Keep in sync with the
// backend BADGE_CODES.OFFRAMP_USER.
const OFFRAMP_BADGE_CODE = 'OFFRAMP_USER'

interface AddMoneyMethodSelectionProps {
    onBankTransferClick: () => void
}

const AddMoneyMethodSelection = ({ onBankTransferClick }: AddMoneyMethodSelectionProps) => {
    const router = useRouter()
    const { user } = useAuth()
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
                <h2 className="text-base font-bold">How would you like to add money?</h2>
                <div className="flex flex-col">
                    {hasOfframpBadge && (
                        <ActionListCard
                            title="Migrate from Offramp"
                            description="Move your Offramp balance to Peanut"
                            position="first"
                            leftIcon={
                                <AvatarWithBadge icon="wallet-outline" size="extra-small" className="bg-yellow-1" />
                            }
                            onClick={() => router.push('/add-money/crypto?network=EVM&source=offramp')}
                        />
                    )}
                    <ActionListCard
                        title="Crypto"
                        description="Deposit from a wallet or exchange"
                        position={hasOfframpBadge ? 'middle' : 'first'}
                        leftIcon={<AvatarWithBadge icon="wallet-outline" size="extra-small" className="bg-yellow-1" />}
                        onClick={() => setIsDrawerOpen(true)}
                    />
                    <ActionListCard
                        title="Bank Transfer"
                        description="KYC required"
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
