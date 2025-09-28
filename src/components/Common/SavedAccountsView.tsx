'use client'
import { countryData as ALL_METHODS_DATA, countryCodeMap } from '@/components/AddMoney/consts'
import { shortenAddressLong, formatIban } from '@/utils/general.utils'
import { AccountType, Account } from '@/interfaces'
import Image from 'next/image'
import { Icon } from '@/components/Global/Icons/Icon'
import { SearchResultCard } from '@/components/SearchUsers/SearchResultCard'

import NavHeader from '../Global/NavHeader'
import Divider from '../0_Bruddle/Divider'
import { Button } from '../0_Bruddle'

interface SavedAccountListProps {
    pageTitle: string
    onPrev: () => void
    savedAccounts: Account[]
    onAccountClick: (account: Account, path: string) => void
    onSelectNewMethodClick: () => void
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
    onSelectNewMethodClick,
}: SavedAccountListProps) {
    return (
        <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
            <NavHeader title={pageTitle} onPrev={onPrev} />
            <div className="space-y-4">
                <div className="flex h-full flex-col justify-center space-y-2">
                    <h2 className="text-base font-bold">Saved accounts</h2>
                    <SavedAccountsMapping accounts={savedAccounts} onItemClick={onAccountClick} />
                </div>
                <Divider textClassname="font-bold text-grey-1" dividerClassname="bg-grey-1" text="or" />
                <Button icon="plus" onClick={onSelectNewMethodClick} shadowSize="4">
                    Select new method
                </Button>
            </div>
        </div>
    )
}

export function SavedAccountsMapping({
    accounts,
    onItemClick,
}: {
    accounts: Account[]
    onItemClick: (account: Account, path: string) => void
}) {
    return (
        <div className="flex flex-col">
            {accounts.map((account, index) => {
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
                const twoLetterCountryCode = countryCodeMap[threeLetterCountryCode] ?? threeLetterCountryCode

                const countryCodeForFlag = twoLetterCountryCode.toLowerCase() ?? ''

                let countryInfo
                if (account.type === AccountType.US) {
                    countryInfo = ALL_METHODS_DATA.find((c) => c.id === 'US')
                } else {
                    countryInfo = details.countryName
                        ? ALL_METHODS_DATA.find((c) => c.path.toLowerCase() === details.countryName?.toLowerCase())
                        : ALL_METHODS_DATA.find((c) => c.id === threeLetterCountryCode)
                }

                const path = countryInfo ? `/withdraw/${countryInfo.path}/bank` : '/withdraw'
                const isSingle = accounts.length === 1
                const isFirst = index === 0
                const isLast = index === accounts.length - 1

                let position: 'first' | 'last' | 'middle' | 'single' = 'middle'
                if (isSingle) position = 'single'
                else if (isFirst) position = 'first'
                else if (isLast) position = 'last'

                return (
                    <SearchResultCard
                        key={account.id}
                        title={shortenAddressLong(formatIban(account.identifier), 6)}
                        position={position}
                        onClick={() => onItemClick(account, path)}
                        className="p-4 py-2.5"
                        leftIcon={
                            <div className="relative h-8 w-8">
                                {countryCodeForFlag && (
                                    <Image
                                        src={`https://flagcdn.com/w160/${account.type === AccountType.US ? 'us' : countryCodeForFlag}.png`}
                                        alt={`${details.countryName ?? 'country'} flag`}
                                        width={80}
                                        height={80}
                                        className="h-8 w-8 rounded-full object-cover"
                                    />
                                )}
                                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 p-1">
                                    <Icon name="bank" className="h-full w-full text-black" />
                                </div>
                            </div>
                        }
                    />
                )
            })}
        </div>
    )
}
