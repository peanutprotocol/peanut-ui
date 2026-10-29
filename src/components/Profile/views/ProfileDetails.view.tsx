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
import type { KycCollectedDetails, KycStoredDetail } from '@/app/actions/types/kyc-paperwork-verification.types'
import { useAuth } from '@/context/authContext'
import { humanizeOccupation, useOccupationLabels } from '@/features/paperwork-verification/occupations/labels'
import { DOCUMENT_KEYS } from '@/features/paperwork-verification/paperworkVerification.utils'
import { useOptionLabel } from '@/features/paperwork-verification/useOptionLabel'
import { useSafeBack } from '@/hooks/useSafeBack'
import { localizedCountryName } from '@/utils/country-name.utils'

export const PROFILE_DETAILS_QUERY_KEY = ['kyc-details'] as const

// What verification collected, in the page's order, by theme.
const IDENTITY_ROWS = ['nationality', 'dateOfBirth', 'countryOfBirth', 'cityOfBirth'] as const
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
type DetailRow =
    | (typeof IDENTITY_ROWS | typeof MONEY_ROWS | typeof PERSONAL_ROWS)[number]
    | 'phone'
    | 'address'
    | 'taxId'

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

/** A stored birth date in the reader's words, kept on its calendar day whatever the time zone. */
function birthDate(locale: string, iso: string) {
    const date = new Date(`${iso}T00:00:00Z`)
    return Number.isNaN(date.getTime())
        ? iso
        : new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date)
}

/**
 * Profile: what Peanut collected at sign-up and in verification. Peanut's own
 * records show their values, every answer included but the address and the tax
 * number; what only Sumsub holds says so instead of a value (Slava,
 * 2026-10-26). A row shows only for something collected.
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
    // KYC's verified name when the account has one, else the one given at sign-up
    const signupName = splitName(user?.user.fullName)
    const name = details?.name?.first ?? signupName.name
    const surname = details?.name?.last ?? signupName.surname
    const email = user?.user.email?.trim()
    const residence = user?.residence
    // a requested change stays declared until verified: the verified country is still the residence
    const residenceCountry = residence?.verified?.country ?? residence?.declared?.country ?? null
    const held = new Set(details?.heldBySumsub ?? [])
    const stored = details?.stored ?? {}
    const optionLabel = useOptionLabel()
    const occupationLabels = useOccupationLabels(!!stored.occupation)
    const notStored = <span className="text-body-s text-foreground-secondary">{t('notStored')}</span>

    const row = (key: string, label: string, value: ReactNode) => (
        <DataRow key={key} label={label} value={value} wrapLabel />
    )
    const shown = (key: KycStoredDetail, value: string): ReactNode => {
        switch (key) {
            case 'countryOfBirth':
                return country(value)
            case 'dateOfBirth':
                return birthDate(locale, value)
            case 'occupation':
                return occupationLabels?.[value] ?? humanizeOccupation(value)
            case 'isPep':
            case 'isFatca':
            case 'isFep':
                return t(value === 'yes' ? 'yes' : 'no')
            case 'cityOfBirth':
            case 'phone':
                return value
            default:
                return optionLabel(key, value)
        }
    }
    const storedRow = (key: KycStoredDetail) => {
        const value = stored[key]
        return value ? row(key, t(`rows.${key}`), shown(key, value)) : null
    }
    const detailRows = (keys: readonly DetailRow[]) =>
        keys.map(
            (key) =>
                (key !== 'nationality' && key !== 'address' && key !== 'taxId' && storedRow(key)) ||
                (held.has(key) ? row(key, t(`rows.${key}`), notStored) : null)
        )

    const document = details?.document
    const documentName = document
        ? `${tDocuments(DOCUMENT_KEYS[document.type as keyof typeof DOCUMENT_KEYS] ?? 'otherDocument')}, ${country(document.country)}`
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
                    {residence?.secondaryDeclaredCountry &&
                        row('secondResidence', t('rows.secondResidence'), country(residence.secondaryDeclaredCountry))}
                    {details?.nationality && row('nationality', t('rows.nationality'), country(details.nationality))}
                    {details?.idNationality &&
                        details.idNationality !== details.nationality &&
                        row('idNationality', t('rows.idNationality'), country(details.idNationality))}
                    {detailRows(IDENTITY_ROWS)}
                    {documentName && row('document', t('rows.document'), documentName)}
                </DataRowGroup>
                {isPending ? (
                    <SkeletonRows />
                ) : (
                    <>
                        <DataRowGroup>
                            {detailRows(['phone'])}
                            {detailRows(['address', 'taxId'])}
                        </DataRowGroup>
                        <DataRowGroup>{detailRows(MONEY_ROWS)}</DataRowGroup>
                        <DataRowGroup>{detailRows(PERSONAL_ROWS)}</DataRowGroup>
                    </>
                )}
            </Card>
        </div>
    )
}
