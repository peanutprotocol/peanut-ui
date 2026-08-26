'use client'
import { useContext } from 'react'
import { useTranslations } from 'next-intl'
import { ActionListCard } from '@/components/ActionListCard'
import DisplayIcon from '@/components/Global/DisplayIcon'
import { Icon } from '@/components/Global/Icons/Icon'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import type { SavedAddress } from '@/interfaces/interfaces'
import { getChainName } from '@/utils/general.utils'
import { shortSavedAddress } from '@/utils/saved-address.utils'
import LastUsedPill from './LastUsedPill'

interface SavedAddressesListProps {
    savedAddresses: SavedAddress[]
    onSelect: (saved: SavedAddress) => void
    onEdit: (saved: SavedAddress) => void
}

/** Crypto address book rows: nickname, short address on chain, last-used pill, edit affordance. */
export default function SavedAddressesList({ savedAddresses, onSelect, onEdit }: SavedAddressesListProps) {
    const t = useTranslations('global')
    const { supportedChainsAndTokens } = useContext(tokenSelectorContext)

    return (
        <div className="flex flex-col">
            {savedAddresses.map((saved, index) => {
                const chain = supportedChainsAndTokens?.[saved.chainId]
                const chainName = chain?.networkName || getChainName(saved.chainId) || saved.chainId
                const position =
                    savedAddresses.length === 1
                        ? 'single'
                        : index === 0
                          ? 'first'
                          : index === savedAddresses.length - 1
                            ? 'last'
                            : 'middle'
                return (
                    <ActionListCard
                        key={saved.id}
                        position={position}
                        className="p-4 py-2.5"
                        onClick={() => onSelect(saved)}
                        title={
                            <span className="flex items-center gap-2">
                                <span className="truncate">{saved.nickname}</span>
                                <LastUsedPill lastUsedAt={saved.lastUsedAt} />
                            </span>
                        }
                        description={`${shortSavedAddress(saved.address)} · ${chainName}`}
                        leftIcon={
                            <div className="relative h-8 w-8">
                                <DisplayIcon
                                    iconUrl={chain?.chainIconURI}
                                    altText={chainName}
                                    fallbackName={chainName}
                                    sizeClass="h-8 w-8"
                                    className="rounded-full"
                                />
                                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 p-1">
                                    <Icon size={12} name="wallet" className="text-black" />
                                </div>
                            </div>
                        }
                        rightContent={
                            <button
                                type="button"
                                aria-label={t('savedAddresses.editAria', { nickname: saved.nickname })}
                                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-grey-4"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onEdit(saved)
                                }}
                            >
                                <Icon name="more-horizontal" size={18} />
                            </button>
                        }
                    />
                )
            })}
        </div>
    )
}
