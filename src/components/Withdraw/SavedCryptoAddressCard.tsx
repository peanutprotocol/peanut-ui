'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { type SavedWithdrawAddress, removeSavedAddress } from '@/utils/savedAddresses'

function truncateAddress(address: string): string {
    if (address.length <= 12) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
}

interface SavedCryptoAddressCardProps {
    savedAddress: SavedWithdrawAddress
    position?: 'single' | 'first' | 'last' | 'middle'
    onClick: (savedAddress: SavedWithdrawAddress) => void
    onRemove?: (id: string) => void
}

export function SavedCryptoAddressCard({
    savedAddress,
    position = 'single',
    onClick,
    onRemove,
}: SavedCryptoAddressCardProps) {
    const borderClasses = {
        single: 'rounded-xl border',
        first: 'rounded-t-xl border border-b-0',
        middle: 'border border-b-0',
        last: 'rounded-b-xl border',
    }

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation()
        removeSavedAddress(savedAddress.id)
        onRemove?.(savedAddress.id)
    }

    return (
        <div
            className={`hover:bg-grey-6 flex cursor-pointer items-center justify-between p-4 py-3 transition-colors ${borderClasses[position]}`}
            onClick={() => onClick(savedAddress)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick(savedAddress)}
        >
            <div className="flex items-center gap-3">
                {/* chain icon placeholder — purple circle with chain initial */}
                <div className="bg-purple flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white">
                    {savedAddress.chainName.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-semibold leading-tight">
                        {savedAddress.label || truncateAddress(savedAddress.address)}
                    </span>
                    <span className="text-xs text-grey-1">
                        {savedAddress.chainName} · {truncateAddress(savedAddress.address)}
                    </span>
                </div>
            </div>
            <button
                className="hover:bg-red-50 hover:text-red-500 ml-2 flex h-7 w-7 items-center justify-center rounded-full text-grey-1"
                onClick={handleRemove}
                aria-label="Remove saved address"
                title="Remove"
            >
                <Icon name="cancel" size={14} />
            </button>
        </div>
    )
}

interface SavedCryptoAddressesListProps {
    addresses: SavedWithdrawAddress[]
    onAddressClick: (savedAddress: SavedWithdrawAddress) => void
    onRemove?: (id: string) => void
}

export function SavedCryptoAddressesList({ addresses, onAddressClick, onRemove }: SavedCryptoAddressesListProps) {
    if (addresses.length === 0) return null

    return (
        <div className="flex flex-col">
            {addresses.map((addr, index) => {
                const isSingle = addresses.length === 1
                const isFirst = index === 0
                const isLast = index === addresses.length - 1

                let position: 'first' | 'last' | 'middle' | 'single' = 'middle'
                if (isSingle) position = 'single'
                else if (isFirst) position = 'first'
                else if (isLast) position = 'last'

                return (
                    <SavedCryptoAddressCard
                        key={addr.id}
                        savedAddress={addr}
                        position={position}
                        onClick={onAddressClick}
                        onRemove={onRemove}
                    />
                )
            })}
        </div>
    )
}
