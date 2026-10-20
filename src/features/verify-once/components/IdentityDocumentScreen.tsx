'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import SetupTitleBlock from '@/components/Setup/components/SetupTitleBlock'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import type { VerifyOnceDocument } from '@/app/actions/types/kyc-verify-once.types'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import { localizedCountryName } from '@/utils/country-name.utils'
import { identityDocuments } from '@/utils/kyc-document-plan.utils'
import { VerifyFooter, VerifyQuestionLayout } from './VerifyLayout'

const DOCUMENT_KEYS = {
    PASSPORT: 'passport',
    ID_CARD: 'idCard',
    DRIVERS: 'drivers',
    RESIDENCE_PERMIT: 'residencePermit',
} as const

function Flag({ country }: { country: string }) {
    return (
        <Image
            src={getFlagUrl(country.toLowerCase())}
            alt=""
            width={64}
            height={64}
            className="size-8 rounded-full object-cover"
        />
    )
}

// A list this long gets a search box (the issuing countries of a catalogue).
const SEARCH_FROM = 12

const normalize = (text: string) =>
    text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()

function OptionDrawer({
    open,
    onOpenChange,
    title,
    searchLabel,
    options,
    value,
    label,
    leading,
    onChoose,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    searchLabel?: string
    options: string[]
    value: string
    label: (option: string) => string
    leading?: (option: string) => React.ReactNode
    onChoose: (option: string) => void
}) {
    const [query, setQuery] = useState('')
    const searchable = !!searchLabel && options.length >= SEARCH_FROM
    const needle = normalize(query.trim())
    const shown = needle ? options.filter((o) => normalize(label(o)).includes(needle)) : options
    return (
        <Drawer
            open={open}
            onOpenChange={(next) => {
                if (!next) setQuery('')
                onOpenChange(next)
            }}
        >
            <DrawerContent>
                <div className={searchable ? 'flex min-h-[75vh] flex-col gap-4 pb-4' : 'flex flex-col gap-4 pb-4'}>
                    <DrawerTitle>{title}</DrawerTitle>
                    {searchable && (
                        <div className="sticky top-0 z-10 bg-white">
                            <BaseInput
                                type="search"
                                autoComplete="off"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={searchLabel}
                                aria-label={searchLabel}
                                leftContent={<Icon name="search" size={20} className="text-foreground-secondary" />}
                            />
                        </div>
                    )}
                    <ListGroup>
                        {shown.map((option) => (
                            <ListItem
                                key={option}
                                title={label(option)}
                                leading={leading?.(option)}
                                trailing={option === value ? <Icon name="check" size={20} /> : undefined}
                                aria-label={label(option)}
                                className={option === value ? 'bg-background-selection' : undefined}
                                onClick={() => {
                                    onChoose(option)
                                    setQuery('')
                                    onOpenChange(false)
                                }}
                            />
                        ))}
                    </ListGroup>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

/**
 * The midpoint: the questions are done, the user picks the ID and who issued
 * it, and Sumsub opens on that document for the photos and the selfie. The
 * list is the plan's identity catalogue, without the feature checkboxes of
 * the document-first picker (signup already chose the features).
 */
export function IdentityDocumentScreen({
    plan,
    residence,
    progress,
    busy,
    error,
    onBack,
    onContinue,
}: {
    plan: KycDocumentPlan | null
    residence: string | null
    progress: { current: number; total: number }
    busy: boolean
    error: string | null
    onBack: () => void
    onContinue: (document: VerifyOnceDocument) => void
}) {
    const t = useTranslations('kyc.verifyOnce')
    const tDocuments = useTranslations('kyc.documents')
    const locale = useLocale()
    const document = identityDocuments(plan?.routes[0])[0]
    const collator = useMemo(() => new Intl.Collator(locale), [locale])
    const countryName = (code: string) => localizedCountryName(locale, code, code)
    const countries = useMemo(
        () =>
            [...(document?.countries ?? [])].sort((a, b) =>
                collator.compare(localizedCountryName(locale, a, a), localizedCountryName(locale, b, b))
            ),
        [document, collator, locale]
    )
    const types = document?.types ?? []
    const [type, setType] = useState(() =>
        types.length === 1 ? types[0] : (types.find((x) => x === 'PASSPORT') ?? '')
    )
    const [country, setCountry] = useState(() =>
        residence && countries.includes(residence) ? residence : countries.length === 1 ? countries[0] : ''
    )
    const [picking, setPicking] = useState<'type' | 'country' | null>(null)
    const typeName = (value: string) =>
        tDocuments(DOCUMENT_KEYS[value as keyof typeof DOCUMENT_KEYS] ?? 'otherDocument')
    const needsProofOfAddress =
        !!country && country !== residence && (plan?.proofOfAddressIdCountries ?? []).includes(country)
    const permitAvoidsProof =
        needsProofOfAddress && !!residence && types.includes('RESIDENCE_PERMIT') && countries.includes(residence)

    return (
        <VerifyQuestionLayout
            progress={progress}
            onBack={onBack}
            footer={
                <VerifyFooter
                    actions={
                        <Button
                            shadowSize="4"
                            className="w-full"
                            disabled={!type || !country || busy || !document}
                            loading={busy}
                            onClick={() => onContinue({ type, issuingCountry: country })}
                            data-testid="verify-id-continue"
                        >
                            {t('midpoint.cta')}
                        </Button>
                    }
                    secondary={
                        <p className="flex items-center gap-1 text-body-xs text-foreground-secondary">
                            <Icon name="lock" size={16} />
                            {t('midpoint.privacy')}
                        </p>
                    }
                >
                    {(error || !document) && (
                        <Callout priority="error" className="w-full text-left" data-testid="verify-id-error">
                            {error ?? t('midpoint.unavailable')}
                        </Callout>
                    )}
                </VerifyFooter>
            }
        >
            <SetupTitleBlock title={t('midpoint.title')} description={t('midpoint.description')} size="m" />
            {document && (
                <ListGroup>
                    <ListItem
                        title={type ? typeName(type) : t('choose')}
                        body={t('midpoint.document')}
                        leading={<IconBubble icon="user-id" size="s" color={type ? 'blue' : 'gray'} />}
                        chevron
                        onClick={() => setPicking('type')}
                        data-testid="verify-id-type"
                    />
                    <ListItem
                        title={country ? countryName(country) : t('choose')}
                        body={t('midpoint.issuedBy')}
                        leading={
                            country ? <Flag country={country} /> : <IconBubble icon="globe" size="s" color="gray" />
                        }
                        chevron
                        onClick={() => setPicking('country')}
                        data-testid="verify-id-country"
                    />
                    {needsProofOfAddress && (
                        <ListItem
                            title={t('midpoint.proofOfAddress')}
                            body={t('midpoint.proofOfAddressBody', { country: countryName(country) })}
                            leading={<IconBubble icon="docs" size="s" color="blue" />}
                            data-testid="verify-id-proof-of-address"
                        />
                    )}
                </ListGroup>
            )}
            {permitAvoidsProof && residence && (
                <p className="text-body-s text-foreground-secondary">
                    {t('midpoint.proofOfAddressPermit', { residence: countryName(residence) })}
                </p>
            )}
            <OptionDrawer
                open={picking === 'type'}
                onOpenChange={(open) => setPicking(open ? 'type' : null)}
                title={t('midpoint.document')}
                options={types}
                value={type}
                label={typeName}
                onChoose={setType}
            />
            <OptionDrawer
                open={picking === 'country'}
                onOpenChange={(open) => setPicking(open ? 'country' : null)}
                title={t('midpoint.issuedBy')}
                searchLabel={t('search.country')}
                options={countries}
                value={country}
                label={countryName}
                leading={(option) => <Flag country={option} />}
                onChoose={setCountry}
            />
        </VerifyQuestionLayout>
    )
}
