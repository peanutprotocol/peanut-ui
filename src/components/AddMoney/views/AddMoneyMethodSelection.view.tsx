'use client'

import { ActionListCard } from '@/components/ActionListCard'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import ChooseNetworkDrawer from '../components/ChooseNetworkDrawer'
import type { RhinoChainType } from '@/services/services.types'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface AddMoneyMethodSelectionProps {
    onBankTransferClick: () => void
}

const AddMoneyMethodSelection = ({ onBankTransferClick }: AddMoneyMethodSelectionProps) => {
    const router = useRouter()
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    const handleNetworkSelect = (network: RhinoChainType) => {
        setIsDrawerOpen(false)
        router.push(`/add-money/crypto?network=${network}`)
    }

    return (
        <>
            <div className="flex flex-col gap-2">
                <h2 className="text-base font-bold">How would you like to add money?</h2>
                <div className="flex flex-col">
                    <ActionListCard
                        title="Crypto"
                        description="Deposit from a wallet or exchange"
                        position="first"
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
