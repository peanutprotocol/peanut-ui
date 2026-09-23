'use client'
import { useContext } from 'react'
import { useTranslations } from 'next-intl'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import DisplayIcon from '@/components/Global/DisplayIcon'
import { Icon } from '@/components/Global/Icons/Icon'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import type { SavedAddress } from '@/interfaces/interfaces'
import { getChainName } from '@/utils/general.utils'
import { daysSince, shortSavedAddress } from '@/utils/saved-address.utils'
import {
    byMostRecentlyUsed,
    destinationLabel,
    savedAddressDestination,
} from '@/features/destinations/saved-destinations'

interface SavedAddressesListProps {
    savedAddresses: SavedAddress[]
    onSelect: (saved: SavedAddress) => void
    onEdit: (saved: SavedAddress) => void
}

/**
 * Crypto address book rows: nickname, then short address, chain and recency on
 * the secondary line, and the edit affordance. Recency is a fact, not a
 * status, so it is not a badge (Konrad, 2026-09-23).
 */
export default function SavedAddressesList({ savedAddresses, onSelect, onEdit }: SavedAddressesListProps) {
    const t = useTranslations('global')
    const { supportedChainsAndTokens } = useContext(tokenSelectorContext)
    const { triggerHaptic } = useAppHaptic()

    return (
        // board 17832:80463: saved rows render as separated single rows, like the bank list
        <div className="flex flex-col gap-2">
            {[...savedAddresses]
                .sort((a, b) => byMostRecentlyUsed(savedAddressDestination(a), savedAddressDestination(b)))
                .map((saved) => {
                    const chain = supportedChainsAndTokens?.[saved.chainId]
                    const chainName = chain?.networkName || getChainName(saved.chainId) || saved.chainId
                    const label = destinationLabel(savedAddressDestination(saved))
                    return (
                        // Select and Edit are sibling controls in a plain row, never
                        // a button inside a button: the select button covers the row
                        // and the edit button sits above it (sep-23 review, A49).
                        <div key={saved.id} className="relative">
                            <ListItem
                                position="solo"
                                title={label}
                                body={`${shortSavedAddress(saved.address)} · ${chainName} · ${t('savedAddresses.lastUsed', { days: daysSince(saved.lastUsedAt) })}`}
                                bodyWrap
                                leading={
                                    <div className="relative h-8 w-8">
                                        <DisplayIcon
                                            iconUrl={chain?.chainIconURI}
                                            altText={chainName}
                                            fallbackName={chainName}
                                            sizeClass="h-8 w-8"
                                            className="rounded-full"
                                        />
                                        <div className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-background-icon-bubble-yellow p-1">
                                            <Icon size={16} name="wallet" className="text-foreground-primary" />
                                        </div>
                                    </div>
                                }
                                trailing={
                                    // holds the edit button's place; the button itself is
                                    // outside the row so it is not nested in the select
                                    <span aria-hidden className="block size-10" />
                                }
                            />
                            <button
                                type="button"
                                aria-label={label}
                                data-testid="saved-address-select"
                                className="absolute inset-0 cursor-pointer rounded-sm transition-colors duration-instant focus-visible:outline-[3px] focus-visible:outline-action-focus active:bg-foreground-primary/5"
                                onClick={() => {
                                    triggerHaptic()
                                    onSelect(saved)
                                }}
                            />
                            <button
                                type="button"
                                aria-label={t('savedDestinations.editAria', { name: label })}
                                data-testid="destination-edit"
                                className="absolute top-1/2 right-4 flex size-10 -translate-y-1/2 items-center justify-center rounded-full transition-colors duration-instant after:absolute after:-inset-0.5 hover:bg-background-disabled focus-visible:outline-[3px] focus-visible:outline-action-focus active:bg-background-disabled"
                                onClick={() => onEdit(saved)}
                            >
                                <Icon name="more-horizontal" size={20} />
                            </button>
                        </div>
                    )
                })}
        </div>
    )
}
