'use client'

import NavHeader from '@/components/Global/NavHeader'
import Loading from '@/components/Global/Loading'
import { CountryList } from '@/components/Common/CountryList'
import SavedAccountsView from '@/components/Common/SavedAccountsView'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import { useAuth } from '@/context/authContext'
import { AccountType, type Account } from '@/interfaces/interfaces'
import { isMantecaCountry } from '@/constants/manteca.consts'
import { getFromLocalStorage } from '@/utils/general.utils'
import { rewriteMethodPath, withdrawCountryUrl } from '@/utils/native-routes'
import { mantecaWithdrawUrl, withdrawCountryFormUrl } from '@/features/withdraw/routes'
import { soleLiveRailForCountry } from '@/features/destinations/country-rails'
import { clearScannedDestination, withdrawTokenForChain } from '@/features/withdraw/destination'
import { useWithdrawFlow } from '@/features/withdraw/WithdrawFlowContext'
import { useSavedAddresses } from '@/hooks/useSavedAddresses'
import DestinationEditDrawer, { type EditableDestination } from '@/features/destinations/DestinationEditDrawer'
import { useRenameAccount } from '@/features/destinations/useRenameAccount'
import { ACCOUNT_LABEL_MAX } from '@/features/destinations/consts'
import { SAVED_ADDRESS_NICKNAME_MAX, shortSavedAddress } from '@/utils/saved-address.utils'
import { maskAccountIdentifier } from '@/utils/account-mask.utils'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import type { SavedAddress } from '@/interfaces/interfaces'
import { useRouter } from 'next/navigation'
import { parseAsBoolean, parseAsString, useQueryState } from 'nuqs'
import { type FC, useContext, useMemo, useState, useTransition } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useTranslations } from 'next-intl'

interface WithdrawMethodViewProps {
    pageTitle: string
    mainHeading: string
    /** Leave the flow (back on the first screen). */
    onExit: () => void
    /** A method was chosen and stored in the flow context — advance to the amount step. */
    onMethodChosen: () => void
}

/**
 * Method-select step of the withdraw flow. The "all methods vs saved accounts"
 * toggle lives in the URL (`?showAll=true`) — it used to be a context boolean
 * owned by two racing effects, which is the TASK-21198 list flicker.
 *
 * Withdraw-only: the former dual-flow AddWithdrawRouterView is gone (its
 * `add` branches had no consumer — add-money renders AddWithdrawCountriesList).
 */
export const WithdrawMethodView: FC<WithdrawMethodViewProps> = ({ pageTitle, mainHeading, onExit, onMethodChosen }) => {
    const router = useRouter()
    const { user } = useAuth()
    const tGlobal = useTranslations('global')
    const { setSelectedBankAccount, setSelectedMethod, setRecipient, setIsValidRecipient } = useWithdrawFlow()
    // crypto address book — its rows render beside the saved bank accounts
    const {
        savedAddresses,
        isLoading: isLoadingSavedAddresses,
        rename: renameSavedAddress,
        remove: removeSavedAddress,
    } = useSavedAddresses()
    const { setSelectedChainID, setSelectedTokenAddress, supportedChainsAndTokens } = useContext(tokenSelectorContext)
    const [editing, setEditing] = useState<EditableDestination | null>(null)
    const renameAccount = useRenameAccount()
    const [, startTransition] = useTransition()
    const [showAllParam, setShowAll] = useQueryState('showAll', parseAsBoolean.withDefault(false))

    const [methodParam] = useQueryState('method', parseAsString)
    const [currencyCode] = useQueryState('currencyCode', parseAsString)
    // if currencyCode is present, show all methods
    const showAll = showAllParam || !!currencyCode

    const isBankFromSend = useSendFlowOrigin().isBankFromSend
    const savedAccounts = useMemo<Account[]>(() => {
        const bankAccounts =
            user?.accounts.filter(
                (acc) =>
                    acc.type === AccountType.IBAN ||
                    acc.type === AccountType.US ||
                    acc.type === AccountType.CLABE ||
                    acc.type === AccountType.GB ||
                    acc.type === AccountType.MANTECA
            ) ?? []
        return bankAccounts as unknown as Account[]
    }, [user])

    // check if we're coming from request fulfillment or similar flow
    const fromRequestFulfillment = typeof window !== 'undefined' && getFromLocalStorage('fromRequestFulfillment')

    const openCryptoDestination = () => {
        setSelectedBankAccount(null)
        setSelectedMethod({ type: 'crypto', countryPath: 'crypto', title: 'Crypto' })
        posthog.capture(ANALYTICS_EVENTS.WITHDRAW_METHOD_SELECTED, { method_type: 'crypto' })
        router.push(isBankFromSend ? '/withdraw/crypto?method=bank' : '/withdraw/crypto')
    }

    // Preserve the saved network and address when opening the destination screen.
    const handleSavedAddressClick = (saved: SavedAddress) => {
        // A destination picked by hand wins over one a scan is still offering.
        clearScannedDestination()
        const token = withdrawTokenForChain(supportedChainsAndTokens?.[saved.chainId]?.tokens)
        setSelectedChainID(saved.chainId)
        setSelectedTokenAddress(token?.address ?? '')
        setRecipient({ name: undefined, address: saved.address })
        setIsValidRecipient(true)
        openCryptoDestination()
    }

    // the plain "Exchange or Wallet" tile is a fresh destination — drop anything
    // an address-book tap left in the recipient state before picking the method
    const handleCryptoTileClick = () => {
        clearScannedDestination()
        setRecipient({ name: undefined, address: '' })
        setIsValidRecipient(false)
        openCryptoDestination()
    }

    // The saved-accounts vs no-accounts split needs the user to have resolved —
    // rendering the empty-state card off a still-null user flashed the wrong
    // screen for signed-in users. Same for the address book: its rows share the
    // saved-accounts screen, so an unresolved list would flash the wrong split.
    if (!user || isLoadingSavedAddresses) {
        return (
            <div className="flex min-h-inherit flex-col justify-center gap-8">
                <Loading variant="mascot" />
            </div>
        )
    }

    if (!showAll && (savedAccounts.length > 0 || savedAddresses.length > 0)) {
        return (
            <>
                <DestinationEditDrawer destination={editing} onClose={() => setEditing(null)} />
                <SavedAccountsView
                    pageTitle={pageTitle}
                    onPrev={onExit}
                    savedAccounts={savedAccounts}
                    onAccountClick={(account, path) => {
                        setSelectedBankAccount(account)
                        const countryPath = account.details?.countryName || path || ''
                        setSelectedMethod({
                            type: account.type === AccountType.MANTECA ? 'manteca' : 'bridge',
                            countryPath,
                            title: 'To Bank',
                        })
                        if (account.type === AccountType.MANTECA) {
                            // Manteca saved accounts skip the shared amount step — the
                            // manteca flow collects the amount in the local currency.
                            // preserve method param if coming from send flow
                            router.push(
                                mantecaWithdrawUrl({
                                    country: countryPath,
                                    destination: account.identifier,
                                    isSavedAccount: 'true',
                                    method: isBankFromSend ? (methodParam ?? undefined) : undefined,
                                })
                            )
                            return
                        }
                        onMethodChosen()
                    }}
                    onSelectNewMethodClick={() => setShowAll(true)}
                    savedAddresses={savedAddresses}
                    onSavedAddressClick={handleSavedAddressClick}
                    onSavedAddressEdit={(saved) =>
                        setEditing({
                            id: saved.id,
                            name: saved.nickname,
                            identifier: shortSavedAddress(saved.address),
                            maxLength: SAVED_ADDRESS_NICKNAME_MAX,
                            rename: (id, name) => renameSavedAddress.mutateAsync({ id, nickname: name }),
                            remove: (id) => removeSavedAddress.mutateAsync(id),
                            removeLabel: tGlobal('savedAddresses.deleteCta'),
                        })
                    }
                    onAccountEdit={(account) =>
                        setEditing({
                            id: account.id,
                            name: account.label ?? '',
                            identifier: maskAccountIdentifier(account.identifier, account.type),
                            maxLength: ACCOUNT_LABEL_MAX,
                            rename: renameAccount,
                        })
                    }
                    onCryptoClick={handleCryptoTileClick}
                />
            </>
        )
    }

    // all-methods view
    return (
        <div className="flex min-h-inherit flex-col justify-normal gap-8">
            <NavHeader
                title={pageTitle}
                onPrev={() => {
                    // if coming from request fulfillment or similar external flow, go back immediately
                    if (fromRequestFulfillment) {
                        onExit()
                        return
                    }
                    // toggle back to saved accounts when the user navigated to "select new method"
                    if (showAllParam && (savedAccounts.length > 0 || savedAddresses.length > 0)) {
                        void setShowAll(null)
                    } else {
                        onExit()
                    }
                }}
            />

            <CountryList
                inputTitle={mainHeading}
                viewMode="add-withdraw"
                enforceSupportedCountries={isBankFromSend}
                onCountryClick={(country) => {
                    const isManteca = isMantecaCountry(country.path)
                    posthog.capture(ANALYTICS_EVENTS.WITHDRAW_METHOD_SELECTED, {
                        method_type: isManteca ? 'manteca' : 'bridge',
                        country: country.path,
                    })

                    // A country with one live rail has nothing to choose — the
                    // per-country list would be a one-row screen, so skip it and
                    // go straight to the destination (mirrors useAddMoneyFlow).
                    // Countries with several live rails still show them, once.
                    const rail = soleLiveRailForCountry(country.id, 'withdraw')
                    if (!rail) {
                        startTransition(() => {
                            router.push(withdrawCountryUrl(country.path))
                        })
                        return
                    }

                    if (isManteca) {
                        // the manteca flow collects the amount in local currency
                        startTransition(() => {
                            router.push(
                                rewriteMethodPath(
                                    rail.path ?? '',
                                    isBankFromSend && methodParam ? `method=${methodParam}` : undefined
                                )
                            )
                        })
                        return
                    }

                    setSelectedMethod({
                        type: 'bridge',
                        countryPath: country.path,
                        currency: country.currency,
                        title: rail.title,
                    })
                    startTransition(() => {
                        router.push(withdrawCountryFormUrl(country.path, isBankFromSend ? methodParam : null))
                    })
                }}
                onCryptoClick={handleCryptoTileClick}
                flow="withdraw"
            />
        </div>
    )
}
