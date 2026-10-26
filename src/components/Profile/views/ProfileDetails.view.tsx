'use client'

import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { DataRowGroup } from '@/components/0_Bruddle/DataRowGroup'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { receiptDataRowCardClassName } from '@/components/TransactionDetails/receipt-data-row-layout'
import { getKycDetails } from '@/app/actions/kyc-paperwork-verification'
import type { KycCollectedDetails } from '@/app/actions/types/kyc-paperwork-verification.types'
import { useAuth } from '@/context/authContext'
import { DOCUMENT_KEYS } from '@/features/paperwork-verification/paperworkVerification.utils'
import { useSafeBack } from '@/hooks/useSafeBack'
import { localizedCountryName } from '@/utils/country-name.utils'

export const PROFILE_DETAILS_QUERY_KEY = ['kyc-details'] as const

// What verification asked that only Sumsub holds, in the page's order, by theme.
const IDENTITY_ROWS = ['citizenship', 'dateOfBirth', 'countryOfBirth', 'cityOfBirth'] as const
const CONTACT_ROWS = ['phone', 'address', 'taxId'] as const
const MONEY_ROWS = [
    'occupation',
    'employmentStatus',
    'annualSalary',
    'expectedMonthlyVolume',
    'bankMonthlyPayments',
    'sourceOfFunds',
    'bankPurpose',
    'cardPurpose',
    'actingAsIntermediary',
] as const
const PERSONAL_ROWS = ['sex', 'maritalStatus', 'isPep', 'isFatca', 'isFep'] as const
type HeldRow = (typeof IDENTITY_ROWS | typeof CONTACT_ROWS | typeof MONEY_ROWS | typeof PERSONAL_ROWS)[number]

const skeleton = 'animate-pulse rounded-full bg-foreground-primary/10 motion-reduce:animate-none'

/** The name as sign-up stored it: the last word is the surname, as on the edit screen. */
function splitName(fullName: string | null | undefined) {
    const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
    const surname = parts.length > 1 ? parts.pop()! : ''
    return { name: parts.join(' '), surname }
}

function SkeletonRows() {
    return (
        <DataRowGroup>
            {[0, 1, 2].map((row) => (
                <div key={row} aria-hidden className="flex items-center justify-between gap-3 py-3">
                    <span className={`h-4 w-28 ${skeleton}`} />
                    <span className={`h-4 w-24 ${skeleton}`} />
                </div>
            ))}
        </DataRowGroup>
    )
}

/**
 * Profile: what Peanut collected at sign-up and in verification. Peanut's own
 * records show their values; what only Sumsub holds says so instead of a value
 * (Slava, 2026-10-26). A row shows only for something collected.
 */
export const ProfileDetailsView = () => {
    const t = useTranslations('profile.details')
    const tDocuments = useTranslations('kyc.documents')
    const locale = useLocale()
    const onBack = useSafeBack('/profile', { replace: true })
    const { user } = useAuth()
    const { data: details, isPending } = useQuery<KycCollectedDetails>({
        queryKey: PROFILE_DETAILS_QUERY_KEY,
        queryFn: getKycDetails,
        staleTime: 60_000,
    })

    const country = (code: string) => localizedCountryName(locale, code, code)
    const { name, surname } = splitName(user?.user.fullName)
    const email = user?.user.email?.trim()
    const residence = user?.residence
    const residenceCountry = residence?.verified ?? residence?.declared ?? null
    const held = new Set(details?.heldBySumsub ?? [])
    const notStored = <span className="text-body-s text-foreground-secondary">{t('notStored')}</span>

    const row = (key: string, label: string, value: ReactNode) => (
        <DataRow key={key} label={label} value={value} wrapLabel />
    )
    const heldRows = (keys: readonly HeldRow[]) =>
        keys.filter((key) => held.has(key)).map((key) => row(key, t(`rows.${key}`), notStored))

    const document = details?.document
    const documentName = document
        ? `${tDocuments(DOCUMENT_KEYS[document.type as keyof typeof DOCUMENT_KEYS] ?? 'otherDocument')}, ${country(document.country)}`
        : null
    const address = details?.address
    const addressText = address
        ? [
              [address.line1, address.line2].filter(Boolean).join(', '),
              [address.postCode, address.city].filter(Boolean).join(' '),
              address.state,
              country(address.country),
          ]
              .filter(Boolean)
              .join(', ')
        : null

    return (
        <div className="flex w-full flex-col gap-6">
            <NavHeader title={t('title')} onPrev={onBack} />
            <Card position="solo" className={receiptDataRowCardClassName} data-testid="profile-details">
                <DataRowGroup>
                    {name && row('name', t('rows.name'), name)}
                    {surname && row('surname', t('rows.surname'), surname)}
                    {email && row('email', t('rows.email'), email)}
                </DataRowGroup>
                <DataRowGroup>
                    {residenceCountry &&
                        row(
                            'residence',
                            t(residence?.verified ? 'rows.verifiedResidence' : 'rows.declaredResidence'),
                            country(residenceCountry)
                        )}
                    {residence?.declaredSecond &&
                        row('secondResidence', t('rows.secondResidence'), country(residence.declaredSecond))}
                    {heldRows(IDENTITY_ROWS)}
                    {documentName && row('document', t('rows.document'), documentName)}
                </DataRowGroup>
                {isPending ? (
                    <SkeletonRows />
                ) : (
                    <>
                        <DataRowGroup>
                            {heldRows(['phone'])}
                            {addressText ? row('address', t('rows.address'), addressText) : heldRows(['address'])}
                            {heldRows(['taxId'])}
                        </DataRowGroup>
                        <DataRowGroup>{heldRows(MONEY_ROWS)}</DataRowGroup>
                        <DataRowGroup>{heldRows(PERSONAL_ROWS)}</DataRowGroup>
                    </>
                )}
            </Card>
        </div>
    )
}
