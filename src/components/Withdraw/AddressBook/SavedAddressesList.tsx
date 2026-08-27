'use client'
import { useContext } from 'react'
import { useTranslations } from 'next-intl'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
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
                return (
                    <ListItem
                        key={saved.id}
                        position={getCardPosition(index, savedAddresses.length)}
                        onClick={() => onSelect(saved)}
                        title={
                            <span className="flex items-center gap-2">
                                <span className="truncate">{saved.nickname}</span>
                                <LastUsedPill lastUsedAt={saved.lastUsedAt} />
                            </span>
                        }
                        body={`${shortSavedAddress(saved.address)} · ${chainName}`}
                        leading={
                            <div className="relative h-8 w-8">
                                <DisplayIcon
                                    iconUrl={chain?.chainIconURI}
                                    altText={chainName}
                                    fallbackName={chainName}
                                    sizeClass="h-8 w-8"
                                    className="rounded-round"
                                />
                                <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-round bg-background-icon-bubble-yellow p-1">
                                    <Icon size={12} name="wallet" className="text-foreground-primary" />
                                </div>
                            </div>
                        }
                        trailing={
                            <button
                                type="button"
                                aria-label={t('savedAddresses.editAria', { nickname: saved.nickname })}
                                // 32px visual, pseudo-element brings the hit area to 44px (touch law)
                                className="relative flex h-8 w-8 items-center justify-center rounded-round transition-colors duration-instant after:absolute after:-inset-1.5 hover:bg-background-disabled focus-visible:outline-[3px] focus-visible:outline-action-focus"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onEdit(saved)
                                }}
                            >
                                <Icon name="more-horizontal" size={20} className="text-foreground-primary" />
                            </button>
                        }
                    />
                )
            })}
        </div>
    )
}
