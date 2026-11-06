'use client'

import { type ReactNode, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { DataRowGroup } from '@/components/0_Bruddle/DataRowGroup'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import DeleteAccountButton from '@/components/Settings/DeleteAccountButton'
import ResidenceMenuItem from '../components/ResidenceMenuItem'
import ShowNameToggle from '../components/ShowNameToggle'
import { EmailSettings } from '../components/EmailSettings'
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

/** The name as sign-up stored it: the last word is the surname. */
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

function NameVisibilitySetting({ visible, label }: { visible: boolean; label: string }) {
    const [preference, setPreference] = useState({ saved: visible, checked: visible })
    if (preference.saved !== visible) setPreference({ saved: visible, checked: visible })
    return (
        <ListItem
            position="solo"
            leading={<IconBubble icon="eye" size="s" color="blue" />}
            title={label}
            trailing={
                <ShowNameToggle
                    checked={preference.saved === visible ? preference.checked : visible}
                    onChange={(checked) => setPreference({ saved: visible, checked })}
                />
            }
        />
    )
}

/**
 * Profile: what the user gave at sign-up and in verification, read from Sumsub,
 * including an address and tax number when the API returns them.
 */
export const ProfileDetailsView = () => {
    const { user } = useAuth()
    return <ProfileDetails key={user?.user.userId} />
}

function ProfileDetails() {
    const t = useTranslations('profile.details')
    const tDocuments = useTranslations('kyc.documents')
    const tMenu = useTranslations('profile.menu')
    const tEmail = useTranslations('profile.edit.fields')
    const locale = useLocale()
    const onBack = useSafeBack('/settings', { replace: true })
    const { user } = useAuth()
    const [openSection, setOpenSection] = useState('')
    const { data: details, isPending } = useQuery<KycCollectedDetails>({
        queryKey: [...PROFILE_DETAILS_QUERY_KEY, user?.user.userId],
        queryFn: getKycDetails,
        enabled: !!user?.user.userId,
        staleTime: 60_000,
    })

    const country = (code: string) => localizedCountryName(locale, code, code)
    // KYC's verified name when the account has one, else the one given at sign-up
    const signupName = splitName(user?.user.fullName)
    const name = details?.name?.first ?? signupName.name
    const surname = details?.name?.last ?? signupName.surname
    const email = user?.user.email?.trim()
    const residence = user?.residence
    const verifiedResidence = residence?.verified?.country
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
    const address = details?.address
    const addressText = address
        ? [
              [address.street, address.buildingNumber].filter(Boolean).join(' '),
              [address.postCode, address.town].filter(Boolean).join(' '),
              address.state,
              address.country && country(address.country),
          ]
              .filter(Boolean)
              .join(', ')
        : ''
    const sensitive = (value: string) => <span className="ph-mask ph-sensitive">{value}</span>
    const sumsubRow = (key: 'address' | 'taxId') => {
        const value = key === 'address' ? addressText : details?.taxId
        return value ? row(key, t(`rows.${key}`), sensitive(value)) : null
    }
    const detailRows = (keys: readonly DetailRow[]) =>
        keys.map((key) =>
            key === 'address' || key === 'taxId'
                ? sumsubRow(key)
                : (key !== 'nationality' && storedRow(key)) ||
                  (held.has(key) ? row(key, t(`rows.${key}`), notStored) : null)
        )

    const document = details?.document
    const documentName = document
        ? `${tDocuments(DOCUMENT_KEYS[document.type as keyof typeof DOCUMENT_KEYS] ?? 'otherDocument')}, ${country(document.country)}`
        : null
    return (
        <div className="flex w-full flex-col gap-6">
            <NavHeader title={t('title')} onPrev={onBack} />
            <ResidenceMenuItem />
            {!!user?.user.fullName?.trim() && (
                <NameVisibilitySetting visible={user.user.showFullName ?? false} label={tMenu('showFullName')} />
            )}
            <Card position="solo" className={receiptDataRowCardClassName} data-testid="profile-details">
                <DataRowGroup>
                    {name && row('name', t('rows.name'), name)}
                    {surname && row('surname', t('rows.surname'), surname)}
                    {email && row('email', t('rows.email'), email)}
                </DataRowGroup>
                <DataRowGroup>
                    {verifiedResidence && row('residence', t('rows.verifiedResidence'), country(verifiedResidence))}
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
            {user && (
                <>
                    <Accordion type="single" collapsible value={openSection} onValueChange={setOpenSection}>
                        <Accordion.Item value="email">
                            <Accordion.Trigger title={tEmail('email')} data-testid="profile-email-settings" />
                            <Accordion.Content>
                                <EmailSettings onSaved={() => setOpenSection('')} />
                            </Accordion.Content>
                        </Accordion.Item>
                    </Accordion>
                    <DeleteAccountButton />
                </>
            )}
        </div>
    )
}
