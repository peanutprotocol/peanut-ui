'use client'

import { useEffect, useMemo, useState } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { usePaperworkVerificationTrack } from '../analytics'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import type { PaperworkVerificationDocument } from '@/app/actions/types/kyc-paperwork-verification.types'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import { localizedCountryName } from '@/utils/country-name.utils'
import { identityDocuments } from '@/utils/kyc-document-plan.utils'
import { twMerge } from '@/utils/tw'
import { IdCardScanAnimation } from './IdCardScanAnimation'
import { useInsetColor } from '../useInsetColor'

const SCREEN_HEIGHT = 'min-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))]'

export const DOCUMENT_KEYS = {
    PASSPORT: 'passport',
    ID_CARD: 'idCard',
    DRIVERS: 'drivers',
    RESIDENCE_PERMIT: 'residencePermit',
    TEMPORARY_PROTECTION: 'temporaryProtection',
} as const

/** The list's order: what a resident most likely holds first. */
const MAIN_TYPES = ['RESIDENCE_PERMIT', 'PASSPORT', 'ID_CARD'] as const

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

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function OptionDrawer({
    open,
    onOpenChange,
    title,
    searchLabel,
    options,
    label,
    leading,
    onChoose,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    searchLabel?: string
    options: string[]
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
                                aria-label={label(option)}
                                onClick={() => {
                                    onChoose(option)
                                    setQuery('')
                                }}
                            />
                        ))}
                    </ListGroup>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

type Choice = PaperworkVerificationDocument

/**
 * The midpoint: the questions are done and the user picks the ID they hold.
 * Each row is a document and the country that issued it (the residence for a
 * permit or a licence, the citizenship for a passport or a national ID), and a
 * tap opens Sumsub on it. Anything else is in "Other document", including any
 * document the plan accepts from another country. `restart`: a verified user
 * picks the ID of a new identity check.
 */
export function IdentityDocumentScreen({
    plan,
    residence,
    citizenship = null,
    restart = false,
    documentsLoading = false,
    busy,
    error,
    onBack,
    onContinue,
    onChangeResidence,
}: {
    plan: KycDocumentPlan | null
    residence: string | null
    /** The citizenship the questions asked, when they did. */
    citizenship?: string | null
    restart?: boolean
    /** the plan is being read again for the documents */
    documentsLoading?: boolean
    busy: boolean
    error: string | null
    onBack: () => void
    onContinue: (document: PaperworkVerificationDocument) => void
    onChangeResidence?: () => void
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const tDocuments = useTranslations('kyc.documents')
    useInsetColor(true)
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
    const protection = plan?.temporaryProtection ?? null
    const types = document?.types ?? []
    const allowed = (type: string, country: string | null): country is string =>
        !!country && types.includes(type as never) && countries.includes(country)
    const away = citizenship && citizenship !== residence ? citizenship : null
    const issuerOf = (type: string) =>
        type === 'RESIDENCE_PERMIT' || type === 'DRIVERS' ? residence : (away ?? residence)
    const keep = (candidates: { type: string; issuingCountry: string | null }[]) =>
        candidates.filter((c): c is Choice => allowed(c.type, c.issuingCountry))
    // A citizen does not hold a residence permit from their own country.
    const main = keep(
        MAIN_TYPES.filter((type) => type !== 'RESIDENCE_PERMIT' || citizenship !== residence).map((type) => ({
            type,
            issuingCountry: issuerOf(type),
        }))
    )
    const other = keep([
        { type: 'DRIVERS', issuingCountry: residence },
        { type: 'DRIVERS', issuingCountry: away },
        // A dual resident's documents from the residence, when the main list shows the citizenship's.
        ...(away ? ['PASSPORT', 'ID_CARD'].map((type) => ({ type, issuingCountry: residence })) : []),
    ])
    const protectionChoices: Choice[] = (protection?.countries ?? []).map((issuingCountry) => ({
        type: 'TEMPORARY_PROTECTION',
        issuingCountry,
    }))
    // What a Ukrainian displaced by the war holds where they live, so it leads for them.
    const protectionInMain = citizenship === 'UA'
    // The citizenship's own passport and ID the route refuses: shown greyed, so nobody takes them to Sumsub.
    const refused: Choice[] = away
        ? ['PASSPORT', 'ID_CARD'].filter((type) => !allowed(type, away)).map((type) => ({ type, issuingCountry: away }))
        : []

    const [otherOpen, setOtherOpen] = useState(false)
    const [picking, setPicking] = useState<'type' | 'country' | null>(null)
    const [pickedType, setPickedType] = useState('')
    const [chosen, setChosen] = useState<string | null>(null)
    const track = usePaperworkVerificationTrack()
    useEffect(() => {
        track(ANALYTICS_EVENTS.KYC_PV_ID_VIEWED, {
            step: 'id',
            document_type_count: types.length,
            issuing_country_count: countries.length,
            main_options: main.length,
            other_options: other.length + (protectionInMain ? 0 : protectionChoices.length),
            refused_options: refused.length,
            citizenship_known: !!citizenship,
            temporary_protection_offered: !!protection,
            temporary_protection_in_main: protectionInMain && !!protection,
        })
        // Once per visit to the midpoint.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const typeName = (value: string) =>
        tDocuments(DOCUMENT_KEYS[value as keyof typeof DOCUMENT_KEYS] ?? 'otherDocument')
    const needsProofOfAddress = (country: string) =>
        country !== residence && (plan?.proofOfAddressIdCountries ?? []).includes(country)
    const keyOf = (c: Choice) => `${c.type}-${c.issuingCountry}`

    const choose = (c: Choice, source: 'list' | 'other' | 'another_country') => {
        if (busy) return
        setChosen(keyOf(c))
        setOtherOpen(false)
        setPicking(null)
        track(ANALYTICS_EVENTS.KYC_PV_ID_SUBMITTED, {
            step: 'id',
            document_type: c.type,
            source,
            issuing_country_is_residence: c.issuingCountry === residence,
            proof_of_address_expected: needsProofOfAddress(c.issuingCountry),
        })
        onContinue(c)
    }
    const row = (c: Choice, source: 'list' | 'other') => {
        const key = keyOf(c)
        const issued = needsProofOfAddress(c.issuingCountry)
            ? t('documentList.issuedByWithProof', { country: countryName(c.issuingCountry) })
            : t('documentList.issuedBy', { country: countryName(c.issuingCountry) })
        return (
            <ListItem
                key={key}
                title={typeName(c.type)}
                body={issued}
                bodyWrap
                leading={<Flag country={c.issuingCountry} />}
                trailing={busy && chosen === key ? <Spinner /> : undefined}
                chevron={!(busy && chosen === key)}
                disabled={busy && chosen !== key}
                onClick={() => choose(c, source)}
                data-testid={`verify-id-option-${key}`}
            />
        )
    }

    const refusedRow = (c: Choice) => (
        <ListItem
            key={`refused-${keyOf(c)}`}
            title={typeName(c.type)}
            body={t('documentList.notAccepted', { country: countryName(c.issuingCountry) })}
            bodyWrap
            leading={
                <span className="opacity-50 grayscale">
                    <Flag country={c.issuingCountry} />
                </span>
            }
            disabled
            data-testid={`verify-id-refused-${keyOf(c)}`}
        />
    )

    const anotherCountryTypes = [...types, ...(protection ? ['TEMPORARY_PROTECTION'] : [])]
    const countriesFor = (type: string) => (type === 'TEMPORARY_PROTECTION' ? (protection?.countries ?? []) : countries)
    const openPicker = (next: 'type' | 'country' | null) => {
        if (next)
            track(ANALYTICS_EVENTS.KYC_PV_PICKER_OPENED, {
                step: 'id',
                field: next === 'type' ? 'document_type' : 'issuing_country',
            })
        setPicking(next)
    }

    return (
        <div className={twMerge('flex w-full flex-col bg-white', SCREEN_HEIGHT)} data-testid="verify-id">
            <div className="absolute inset-x-0 top-4 z-20 mx-auto grid w-full max-w-md grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center px-4">
                <Button
                    variant="ghost"
                    onClick={onBack}
                    className={twMerge(NAV_CIRCLE_BUTTON_CLASSES, 'bg-white')}
                    aria-label={t('back')}
                    data-testid="verify-back"
                >
                    <Icon name="chevron-up" size={20} className="-rotate-90" />
                </Button>
                <div
                    role="img"
                    aria-label={t('documentList.stepDots')}
                    className="flex items-center justify-center gap-2"
                >
                    <span className="h-2 w-7 rounded-full bg-black" />
                    <span className="size-2 rounded-full bg-black/30" />
                    <span className="size-2 rounded-full bg-black/30" />
                </div>
                <span />
            </div>
            <div className="setup-hero-background relative h-68 w-full shrink-0 short:h-52">
                <IdCardScanAnimation className="absolute bottom-2.5 left-1/2 h-51 w-61.5 -translate-x-1/2 short:h-36 short:w-43.5" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pt-6 pb-6">
                <h1 className="text-heading-m whitespace-pre-line text-foreground-primary">
                    {t(restart ? 'midpoint.restartTitle' : 'documentList.title')}
                </h1>
                <p className="text-body-m leading-[1.625rem] text-foreground-secondary">
                    {t(restart ? 'midpoint.restartDescription' : 'documentList.description')}
                </p>
                {document && (
                    <ListGroup>
                        {main.map((c) => row(c, 'list'))}
                        {protectionInMain && protectionChoices.map((c) => row(c, 'list'))}
                        {refused.map(refusedRow)}
                        <ListItem
                            title={t('documentList.other')}
                            body={t('documentList.otherHint')}
                            leading={<IconBubble icon="docs" size="s" color="gray" />}
                            chevron
                            disabled={busy}
                            onClick={() => {
                                track(ANALYTICS_EVENTS.KYC_PV_PICKER_OPENED, { step: 'id', field: 'other_documents' })
                                setOtherOpen(true)
                            }}
                            data-testid="verify-id-other"
                        />
                    </ListGroup>
                )}
                {!document && documentsLoading && <DocumentListSkeleton />}
                {(error || (!document && !documentsLoading)) && (
                    <Callout priority="error" className="w-full text-left" data-testid="verify-id-error">
                        {error ?? t('midpoint.unavailable')}
                    </Callout>
                )}
                {onChangeResidence && (
                    <p className="flex flex-wrap items-baseline gap-1 text-body-s text-foreground-secondary">
                        <span>{t('documentList.noneFit')}</span>
                        <LinkButton onClick={onChangeResidence} data-testid="verify-id-change-residence">
                            {t('documentList.changeResidence')}
                        </LinkButton>
                    </p>
                )}
                <p className="mt-auto pt-4 text-center text-body-xs text-foreground-secondary">
                    {t('midpoint.privacy')}
                </p>
            </div>
            <Drawer open={otherOpen} onOpenChange={setOtherOpen}>
                <DrawerContent>
                    <div className="flex flex-col gap-4 pb-4" data-testid="verify-id-other-drawer">
                        <DrawerTitle>{t('documentList.otherTitle')}</DrawerTitle>
                        <p className="text-body-s text-foreground-secondary">{t('documentList.otherDescription')}</p>
                        <ListGroup>
                            {[...other, ...(protectionInMain ? [] : protectionChoices)].map((c) => row(c, 'other'))}
                            <ListItem
                                title={t('documentList.anotherCountry')}
                                body={t('documentList.anotherCountryHint')}
                                bodyWrap
                                leading={<IconBubble icon="globe" size="s" color="gray" />}
                                chevron
                                disabled={busy}
                                onClick={() => {
                                    setOtherOpen(false)
                                    openPicker('type')
                                }}
                                data-testid="verify-id-another-country"
                            />
                        </ListGroup>
                        <p className="flex items-start gap-2 text-body-s text-foreground-secondary">
                            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                            {t('documentList.otherNotAccepted')}
                        </p>
                        <Button
                            variant="secondary"
                            shadowSize="4"
                            className="w-full"
                            onClick={() => setOtherOpen(false)}
                        >
                            {t('documentList.backToList')}
                        </Button>
                    </div>
                </DrawerContent>
            </Drawer>
            <OptionDrawer
                open={picking === 'type'}
                onOpenChange={(open) => openPicker(open ? 'type' : null)}
                title={t('midpoint.document')}
                options={anotherCountryTypes}
                label={typeName}
                onChoose={(type) => {
                    setPickedType(type)
                    openPicker('country')
                }}
            />
            <OptionDrawer
                open={picking === 'country'}
                onOpenChange={(open) => openPicker(open ? 'country' : null)}
                title={t('midpoint.issuedBy')}
                searchLabel={t('search.country')}
                options={countriesFor(pickedType)}
                label={countryName}
                leading={(option) => <Flag country={option} />}
                onChoose={(issuingCountry) => choose({ type: pickedType, issuingCountry }, 'another_country')}
            />
        </div>
    )
}

/** The list's shape while the plan is read again for its documents. */
function DocumentListSkeleton() {
    return (
        <div
            aria-hidden
            className="flex flex-col divide-y divide-border-default rounded-sm border border-border-default"
            data-testid="verify-id-loading"
        >
            {[0, 1].map((row) => (
                <div key={row} className="flex items-center gap-3 px-4 py-4">
                    <span className="size-8 shrink-0 animate-pulse rounded-full bg-foreground-primary/10 motion-reduce:animate-none" />
                    <span className="flex flex-1 flex-col gap-2">
                        <span className="h-4 w-36 animate-pulse rounded-full bg-foreground-primary/10 motion-reduce:animate-none" />
                        <span className="h-3 w-24 animate-pulse rounded-full bg-foreground-primary/10 motion-reduce:animate-none" />
                    </span>
                </div>
            ))}
        </div>
    )
}

function Spinner() {
    return (
        <span
            aria-hidden
            className="size-5 animate-spin rounded-full border-2 border-black border-r-transparent motion-reduce:animate-none"
        />
    )
}
