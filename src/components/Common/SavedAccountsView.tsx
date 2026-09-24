'use client'
import { countryData as ALL_METHODS_DATA, ALL_COUNTRIES_ALPHA3_TO_ALPHA2 } from '@/components/AddMoney/consts'
import { accountDestination, byMostRecentlyUsed, destinationLabel } from '@/features/destinations/saved-destinations'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { Section } from '@/components/0_Bruddle/Section'

import { AccountType, type Account, type SavedAddress } from '@/interfaces/interfaces'
import SavedAddressesList from '@/features/withdraw/components/AddressBook/SavedAddressesList'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Icon } from '@/components/Global/Icons/Icon'

import NavHeader from '../Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'

interface SavedAccountListProps {
    pageTitle: string
    onPrev: () => void
    savedAccounts: Account[]
    onAccountClick: (account: Account, path: string) => void
    /** "Bank" row under Add new account — opens the new-method country list */
    onSelectNewMethodClick: () => void
    /** Rename a saved account — omitted where the surface has no edit drawer. */
    onAccountEdit?: (account: Account) => void
    /** Crypto address book — rendered as its own list under the bank accounts. */
    savedAddresses?: SavedAddress[]
    onSavedAddressClick?: (saved: SavedAddress) => void
    onSavedAddressEdit?: (saved: SavedAddress) => void
    /** optional "Exchange or Wallet" row (withdraw board 17832:80463) */
    onCryptoClick?: () => void
}

/**
 * Component to render saved bank accounts
 *
 * @param {object} props
 * @param {string} props.pageTitle The title of the page
 * @param {function} props.onPrev The function to call when the previous button is clicked
 * @param {Account[]} props.savedAccounts The accounts to render
 * @param {function} props.onAccountClick The function to call when an account is clicked
 * @param {function} props.onSelectNewMethodClick The function to call when the select new method button is clicked
 */
export default function SavedAccountsView({
    pageTitle,
    onPrev,
    savedAccounts,
    onAccountClick,
    onAccountEdit,
    onSelectNewMethodClick,
    savedAddresses = [],
    onSavedAddressClick,
    onSavedAddressEdit,
    onCryptoClick,
}: SavedAccountListProps) {
    const t = useTranslations('global')
    const tSend = useTranslations('send')
    const tWithdraw = useTranslations('withdraw')
    const plusTrailing = <Icon name="plus" size={20} className="text-foreground-primary" />
    return (
        <div className="flex min-h-inherit flex-col justify-normal gap-8">
            <NavHeader title={pageTitle} onPrev={onPrev} />
            <div className="space-y-6">
                {onCryptoClick ? (
                    // withdraw flow (board 17832:80463): both rails stay visible even when
                    // one has no saved destinations, so bank and crypto withdrawal are
                    // always reachable. Saved rows sit under their rail's entry row (TASK-22589).
                    <>
                        <Section title={t('savedAccounts.bankSectionTitle')}>
                            {savedAccounts.length > 0 && (
                                <SavedAccountsMapping
                                    accounts={savedAccounts}
                                    onItemClick={onAccountClick}
                                    onItemEdit={onAccountEdit}
                                />
                            )}
                            <ListItem
                                position="solo"
                                leading={<IconBubble icon="bank" size="s" color="gray" />}
                                // a ReactNode title wraps; a bare string is cut to one
                                // line, and the pt-BR label does not fit at 375
                                title={<span>{tWithdraw('withdrawToBank')}</span>}
                                body={tSend('methods.bankDescription')}
                                trailing={plusTrailing}
                                onClick={onSelectNewMethodClick}
                                data-testid="withdraw-add-bank"
                            />
                        </Section>
                        <Section title={t('savedAddresses.title')}>
                            {savedAddresses.length > 0 && onSavedAddressClick && onSavedAddressEdit && (
                                <SavedAddressesList
                                    savedAddresses={savedAddresses}
                                    onSelect={onSavedAddressClick}
                                    onEdit={onSavedAddressEdit}
                                />
                            )}
                            <ListItem
                                position="solo"
                                leading={<IconBubble icon="credit-card" size="s" color="blue" />}
                                title={tWithdraw('withdrawToCrypto')}
                                body={tSend('methods.exchangeOrWalletDescription')}
                                trailing={plusTrailing}
                                onClick={onCryptoClick}
                                data-testid="withdraw-add-crypto"
                            />
                        </Section>
                    </>
                ) : (
                    // legacy callers (claim's BankFlowManager) keep the single saved-list +
                    // "select new method" button so the withdraw redesign doesn't leak in
                    <>
                        {savedAccounts.length > 0 && (
                            <Section title={t('savedAccounts.title')} className="h-full justify-center">
                                <SavedAccountsMapping
                                    accounts={savedAccounts}
                                    onItemClick={onAccountClick}
                                    onItemEdit={onAccountEdit}
                                />
                            </Section>
                        )}
                        <Button icon="plus" onClick={onSelectNewMethodClick} shadowSize="4">
                            {t('savedAccounts.selectNewMethod')}
                        </Button>
                    </>
                )}
            </div>
        </div>
    )
}

export function SavedAccountsMapping({
    accounts,
    onItemClick,
    onItemEdit,
}: {
    accounts: Account[]
    onItemClick: (account: Account, path: string) => void
    onItemEdit?: (account: Account) => void
}) {
    const t = useTranslations('global')
    const locale = useLocale()

    // most recently used first — the account someone withdrew to last week is
    // the one they reach for again (TASK-22589)
    const rows = accounts
        .map((account) => ({ account, ...describeAccount(account, locale) }))
        .sort((a, b) => byMostRecentlyUsed(a.destination, b.destination))

    return (
        // board 17832:80463: saved accounts render as separated single rows
        <div className="flex flex-col gap-2">
            {rows.map(({ account, destination, countryCodeForFlag, countryName, path }) => (
                <ListItem
                    key={account.id}
                    title={destinationLabel(destination)}
                    body={destination.identifier}
                    position="solo"
                    onClick={() => onItemClick(account, path)}
                    chevron={!onItemEdit}
                    trailing={
                        onItemEdit ? (
                            <button
                                type="button"
                                aria-label={t('savedDestinations.editAria', { name: destinationLabel(destination) })}
                                data-testid="destination-edit"
                                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-instant hover:bg-background-disabled active:bg-background-disabled"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onItemEdit(account)
                                }}
                            >
                                <Icon name="more-horizontal" size={20} />
                            </button>
                        ) : undefined
                    }
                    leading={
                        // board leading: plain 32px flag / brand bubble, no corner badge
                        countryCodeForFlag ? (
                            <Image
                                src={getFlagUrl(account.type === AccountType.US ? 'us' : countryCodeForFlag)}
                                alt={
                                    countryName
                                        ? t('savedAccounts.flagAlt', { country: countryName })
                                        : t('savedAccounts.flagAltGeneric')
                                }
                                width={80}
                                height={80}
                                className="size-8 min-w-8 rounded-full object-cover"
                            />
                        ) : (
                            <IconBubble icon="bank" size="s" color="gray" />
                        )
                    }
                />
            ))}
        </div>
    )
}

/** Everything a row needs from one account: its destination shape, its flag and where it goes. */
function describeAccount(account: Account, locale: string) {
    let details: { countryCode?: string; countryName?: string; country?: string } = {}
    if (typeof account.details === 'string') {
        try {
            details = JSON.parse(account.details)
        } catch (error) {
            console.error('Failed to parse account_details:', error)
        }
    } else if (typeof account.details === 'object' && account.details !== null) {
        details = account.details as { country?: string }
    }

    const threeLetterCountryCode = (details.countryCode ?? '').toUpperCase()
    const twoLetterCountryCode = ALL_COUNTRIES_ALPHA3_TO_ALPHA2[threeLetterCountryCode] ?? threeLetterCountryCode

    let countryInfo
    if (account.type === AccountType.US) {
        countryInfo = ALL_METHODS_DATA.find((c) => c.id === 'US')
    } else {
        countryInfo = details.countryName
            ? ALL_METHODS_DATA.find((c) => c.path.toLowerCase() === details.countryName?.toLowerCase())
            : ALL_METHODS_DATA.find((c) => c.id === threeLetterCountryCode)
    }

    const countryName = countryInfo ? localizedCountryTitle(locale, countryInfo) : (details.countryName ?? '')

    return {
        destination: accountDestination(account, { countryName }),
        // The alpha-3 table covers the SEPA and Manteca countries alone, so a
        // Mexican account kept its "MEX" and asked for /flags/mex.svg, which does
        // not exist. The catalogue entry knows the two-letter code; a code that
        // is still not two letters shows no flag, not a broken image.
        countryCodeForFlag: (twoLetterCountryCode.length === 2
            ? twoLetterCountryCode
            : (countryInfo?.iso2 ??
              ALL_METHODS_DATA.find((country) => country.iso3 === threeLetterCountryCode)?.iso2 ??
              '')
        ).toLowerCase(),
        countryName,
        path: countryInfo ? `/withdraw/${countryInfo.path}/bank` : '/withdraw',
    }
}
