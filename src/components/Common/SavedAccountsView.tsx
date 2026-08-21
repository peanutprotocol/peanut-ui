'use client'
import { countryData as ALL_METHODS_DATA, ALL_COUNTRIES_ALPHA3_TO_ALPHA2 } from '@/components/AddMoney/consts'
import { formatIban } from '@/utils/general.utils'
import { AccountType, type Account } from '@/interfaces/interfaces'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Icon } from '@/components/Global/Icons/Icon'

import NavHeader from '../Global/NavHeader'
import Divider from '../0_Bruddle/Divider'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import MERCADO_PAGO from '@/assets/payment-apps/mercado-pago.svg'

// brand name, not translatable copy (copy-props-from-catalog wants no literal props)
const MERCADO_PAGO_BRAND = 'Mercado Pago'

interface SavedAccountListProps {
    pageTitle: string
    onPrev: () => void
    savedAccounts: Account[]
    onAccountClick: (account: Account, path: string) => void
    /** "Bank" row under Add new account — opens the new-method country list */
    onSelectNewMethodClick: () => void
    /** optional "Exchange or Wallet" row (withdraw board 17832:80463) */
    onCryptoClick?: () => void
    /** optional "Mercado Pago" row (withdraw board 17832:80463) */
    onMercadoPagoClick?: () => void
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
    onCryptoClick,
    onMercadoPagoClick,
}: SavedAccountListProps) {
    const t = useTranslations('global')
    const tCommon = useTranslations('common')
    const tSend = useTranslations('send')
    const tWithdraw = useTranslations('withdraw')
    const plusTrailing = <Icon name="plus" size={20} className="text-foreground-primary" />
    return (
        <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
            <NavHeader title={pageTitle} onPrev={onPrev} />
            <div className="space-y-6">
                <div className="space-y-2 flex h-full flex-col justify-center">
                    <h2 className="text-heading-card text-foreground-primary">{t('savedAccounts.title')}</h2>
                    <SavedAccountsMapping accounts={savedAccounts} onItemClick={onAccountClick} />
                </div>
                <Divider
                    textClassname="text-label-m text-foreground-secondary"
                    dividerClassname="bg-border-subtle"
                    text={tCommon('or')}
                />
                {/* add-new-account section per the withdraw board (17832:80463).
                    only the withdraw flow passes the extra callbacks — other
                    callers (claim's BankFlowManager) keep the legacy button so
                    the redesign doesn't leak into their screens */}
                {onCryptoClick || onMercadoPagoClick ? (
                    <div className="space-y-2">
                        <h2 className="text-heading-card text-foreground-primary">{tWithdraw('addNewAccount')}</h2>
                        <ListItem
                            position="single"
                            leading={<IconBubble icon="bank" size="s" color="gray" />}
                            title={tSend('methods.bankTitle')}
                            body={tSend('methods.bankDescription')}
                            trailing={plusTrailing}
                            onClick={onSelectNewMethodClick}
                            data-testid="withdraw-add-bank"
                        />
                        {onMercadoPagoClick && (
                            <ListItem
                                position="single"
                                leading={
                                    <Image
                                        src={MERCADO_PAGO}
                                        alt="Mercado Pago"
                                        width={32}
                                        height={32}
                                        className="size-8 min-w-8"
                                    />
                                }
                                title={MERCADO_PAGO_BRAND}
                                body={tWithdraw('mercadoPagoDescription')}
                                trailing={plusTrailing}
                                onClick={onMercadoPagoClick}
                                data-testid="withdraw-add-mercado-pago"
                            />
                        )}
                        {onCryptoClick && (
                            <ListItem
                                position="single"
                                leading={<IconBubble icon="credit-card" size="s" color="yellow" />}
                                title={tSend('methods.exchangeOrWalletTitle')}
                                body={tSend('methods.exchangeOrWalletDescription')}
                                trailing={plusTrailing}
                                onClick={onCryptoClick}
                                data-testid="withdraw-add-crypto"
                            />
                        )}
                    </div>
                ) : (
                    <Button icon="plus" onClick={onSelectNewMethodClick} shadowSize="4">
                        {t('savedAccounts.selectNewMethod')}
                    </Button>
                )}
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
    const t = useTranslations('global')
    return (
        // board 17832:80463: saved accounts render as separated single rows
        <div className="flex flex-col gap-2">
            {accounts.map((account) => {
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
                const twoLetterCountryCode =
                    ALL_COUNTRIES_ALPHA3_TO_ALPHA2[threeLetterCountryCode] ?? threeLetterCountryCode

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

                const title = account.type === AccountType.IBAN ? formatIban(account.identifier) : account.identifier

                return (
                    <ListItem
                        key={account.id}
                        // node-wrapped so long ibans wrap instead of truncating
                        title={<div>{title}</div>}
                        position="single"
                        onClick={() => onItemClick(account, path)}
                        className="p-4 py-2"
                        chevron
                        leading={
                            // board leading: plain 32px flag / brand bubble, no corner badge
                            countryCodeForFlag ? (
                                <Image
                                    src={getFlagUrl(account.type === AccountType.US ? 'us' : countryCodeForFlag)}
                                    alt={
                                        details.countryName
                                            ? t('savedAccounts.flagAlt', { country: details.countryName })
                                            : t('savedAccounts.flagAltGeneric')
                                    }
                                    width={80}
                                    height={80}
                                    className="size-8 min-w-8 rounded-round object-cover"
                                />
                            ) : (
                                <IconBubble icon="bank" size="s" color="gray" />
                            )
                        }
                    />
                )
            })}
        </div>
    )
}
