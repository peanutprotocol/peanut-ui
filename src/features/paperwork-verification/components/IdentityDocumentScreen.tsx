'use client'

import { useEffect, useState } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { usePaperworkVerificationTrack } from '../analytics'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
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
import { DOCUMENT_KEYS } from '../paperworkVerification.utils'
import { useInsetColor } from '../useInsetColor'

const SCREEN_HEIGHT = 'min-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))]'

/** The list's order: what a resident most likely holds first. */
const MAIN_TYPES = ['RESIDENCE_PERMIT', 'PASSPORT', 'ID_CARD'] as const
const FEATURES = ['qr', 'local', 'card', 'bank'] as const
type Feature = (typeof FEATURES)[number]

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

type Choice = PaperworkVerificationDocument

/**
 * The midpoint: the questions are done and the user picks the ID they hold.
 * Each row is a document and the country that issued it (the residence for a
 * permit or a licence, the nationality for a passport or a national ID), and a
 * tap opens Sumsub on it. Anything else is in "Other document"; a document
 * from a country not on these lists cannot be picked (Slava, 2026-10-26).
 * An ID whose issuer would make a provider refuse every feature the user
 * asked for is greyed; one that refuses some says which, and asks before
 * Sumsub opens (Slava, 2026-10-27).
 * `restart`: a verified user picks the ID of a new identity check.
 */
export function IdentityDocumentScreen({
    plan,
    residence,
    nationality = null,
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
    /** The nationality the questions asked, when they did. */
    nationality?: string | null
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
    const countryName = (code: string) => localizedCountryName(locale, code, code)
    const countries = document?.countries ?? []
    const protection = plan?.temporaryProtection ?? null
    const types = document?.types ?? []
    const allowed = (type: string, country: string | null): country is string =>
        !!country && types.includes(type as never) && countries.includes(country)
    const away = nationality && nationality !== residence ? nationality : null
    const issuerOf = (type: string) =>
        type === 'RESIDENCE_PERMIT' || type === 'DRIVERS' ? residence : (away ?? residence)
    const keep = (candidates: { type: string; issuingCountry: string | null }[]) =>
        candidates.filter((c): c is Choice => allowed(c.type, c.issuingCountry))
    // The nationality may only have defaulted to the residence, so the residence permit always shows.
    const main = keep(MAIN_TYPES.map((type) => ({ type, issuingCountry: issuerOf(type) })))
    const other = keep([
        { type: 'DRIVERS', issuingCountry: residence },
        { type: 'DRIVERS', issuingCountry: away },
        // A dual resident's documents from the residence, when the main list shows the nationality's.
        ...(away ? ['PASSPORT', 'ID_CARD'].map((type) => ({ type, issuingCountry: residence })) : []),
    ])
    // The server's plan decides who is offered temporary protection.
    const protectionChoices: Choice[] = (protection?.countries ?? []).map((issuingCountry) => ({
        type: 'TEMPORARY_PROTECTION',
        issuingCountry,
    }))
    // What a Ukrainian displaced by the war holds where they live, so it leads for them.
    const protectionInMain = nationality === 'UA'
    // The nationality's own passport and ID the route refuses: shown greyed, so nobody takes them to Sumsub.
    const refused: Choice[] = away
        ? ['PASSPORT', 'ID_CARD'].filter((type) => !allowed(type, away)).map((type) => ({ type, issuingCountry: away }))
        : []

    const otherChoices = [...other, ...(protectionInMain ? [] : protectionChoices)]
    const asked = FEATURES.filter((f) => plan?.features?.[f])
    // What the issuer closes, plus what this type closes on top: a German licence refuses the card, a German ID card doesn't.
    const closedBy = (c: Choice): Feature[] => [
        ...new Set([
            ...(plan?.documentRefusals?.[c.issuingCountry] ?? []),
            ...(plan?.documentTypeRefusals?.[c.issuingCountry]?.[c.type] ?? []),
        ]),
    ]
    const closesAll = (c: Choice) => asked.length > 0 && asked.every((f) => closedBy(c).includes(f))
    const listed = [...main, ...(protectionInMain ? protectionChoices : []), ...otherChoices]
    const pickable = listed.some((c) => !closesAll(c))
    const featureRefused = listed.filter(closesAll).length
    // Neither the residence's documents nor the nationality's: name both, so the user knows what failed.
    const unpickableCountries = new Intl.ListFormat(locale, { type: 'disjunction' }).format(
        [...new Set([away ?? residence, residence].filter((c): c is string => !!c))].map(countryName)
    )
    const [otherOpen, setOtherOpen] = useState(false)
    const [chosen, setChosen] = useState<string | null>(null)
    // Kept after the drawer closes, so its content stays while it slides away.
    const [limited, setLimited] = useState<{ choice: Choice; source: 'list' | 'other' } | null>(null)
    const [limitedOpen, setLimitedOpen] = useState(false)
    const track = usePaperworkVerificationTrack()
    useEffect(() => {
        track(ANALYTICS_EVENTS.KYC_PV_ID_VIEWED, {
            step: 'id',
            document_type_count: types.length,
            issuing_country_count: countries.length,
            main_options: main.length,
            other_options: otherChoices.length,
            refused_options: refused.length,
            feature_refused_options: featureRefused,
            feature_limited_options: listed.filter((c) => !closesAll(c) && closedBy(c).length > 0).length,
            nationality_known: !!nationality,
            temporary_protection_offered: protectionChoices.length > 0,
            temporary_protection_in_main: protectionInMain && protectionChoices.length > 0,
        })
        // Once per visit to the midpoint.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const typeName = (value: string) =>
        tDocuments(DOCUMENT_KEYS[value as keyof typeof DOCUMENT_KEYS] ?? 'otherDocument')
    // A temporary protection sheet is issued where the holder lives, so the API flags it on its own.
    const needsProofOfAddress = (c: Choice) =>
        c.type === 'TEMPORARY_PROTECTION'
            ? !!plan?.temporaryProtection?.proofOfAddress
            : c.issuingCountry !== residence && (plan?.proofOfAddressIdCountries ?? []).includes(c.issuingCountry)
    const keyOf = (c: Choice) => `${c.type}-${c.issuingCountry}`
    const limits = (c: Choice) => closedBy(c).map((f) => t(`documentList.closes.${f}`))

    const choose = (c: Choice, source: 'list' | 'other') => {
        if (busy) return
        setChosen(keyOf(c))
        setOtherOpen(false)
        track(ANALYTICS_EVENTS.KYC_PV_ID_SUBMITTED, {
            step: 'id',
            document_type: c.type,
            source,
            issuing_country_is_residence: c.issuingCountry === residence,
            proof_of_address_expected: needsProofOfAddress(c),
            features_closed: closedBy(c).length,
        })
        onContinue(c)
    }
    const pick = (c: Choice, source: 'list' | 'other') => {
        if (busy) return
        if (closedBy(c).length === 0) return choose(c, source)
        setOtherOpen(false)
        setLimited({ choice: c, source })
        setLimitedOpen(true)
    }
    const row = (c: Choice, source: 'list' | 'other') => {
        if (closesAll(c)) return refusedRow(c, t('documentList.closesAll', { country: countryName(c.issuingCountry) }))
        const key = keyOf(c)
        const country = countryName(c.issuingCountry)
        const closed = limits(c).join(' ')
        const issued = needsProofOfAddress(c)
            ? [t('documentList.issuedByWithProof', { country }), closed].filter(Boolean).join(' ')
            : closed
              ? t('documentList.issuedByLimited', { country, limits: closed })
              : t('documentList.issuedBy', { country })
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
                onClick={() => pick(c, source)}
                data-testid={`verify-id-option-${key}`}
            />
        )
    }

    const refusedRow = (
        c: Choice,
        body = t('documentList.notAccepted', { country: countryName(c.issuingCountry) })
    ) => (
        <ListItem
            key={`refused-${keyOf(c)}`}
            title={typeName(c.type)}
            body={body}
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
                {document && !pickable && featureRefused === 0 && (
                    <Callout priority="error" className="w-full text-left" data-testid="verify-id-none-accepted">
                        {t('documentList.noneAccepted', { countries: unpickableCountries })}
                    </Callout>
                )}
                {document && (pickable || featureRefused > 0) && (
                    <ListGroup>
                        {protectionInMain && protectionChoices.map((c) => row(c, 'list'))}
                        {main.map((c) => row(c, 'list'))}
                        {refused.map((c) => refusedRow(c))}
                        {otherChoices.length > 0 && (
                            <ListItem
                                title={t('documentList.other')}
                                body={t('documentList.otherHint')}
                                leading={<IconBubble icon="docs" size="s" color="gray" />}
                                chevron
                                disabled={busy}
                                onClick={() => {
                                    track(ANALYTICS_EVENTS.KYC_PV_PICKER_OPENED, {
                                        step: 'id',
                                        field: 'other_documents',
                                    })
                                    setOtherOpen(true)
                                }}
                                data-testid="verify-id-other"
                            />
                        )}
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
                        <ListGroup>{otherChoices.map((c) => row(c, 'other'))}</ListGroup>
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
            <Drawer open={limitedOpen} onOpenChange={setLimitedOpen}>
                <DrawerContent>
                    {limited && (
                        <div className="flex flex-col gap-4 pb-4" data-testid="verify-id-limited-drawer">
                            <DrawerTitle>{t('documentList.limitedTitle')}</DrawerTitle>
                            <ListGroup>
                                <ListItem
                                    title={typeName(limited.choice.type)}
                                    body={t('documentList.issuedBy', {
                                        country: countryName(limited.choice.issuingCountry),
                                    })}
                                    leading={<Flag country={limited.choice.issuingCountry} />}
                                />
                            </ListGroup>
                            <Callout priority="attention" className="w-full text-left">
                                {limits(limited.choice).join(' ')}
                            </Callout>
                            {residence &&
                                limited.choice.issuingCountry !== residence &&
                                !plan?.documentRefusals?.[residence]?.length && (
                                    <p className="text-body-s text-foreground-secondary">
                                        {t('documentList.residenceUnlocks', { country: countryName(residence) })}
                                    </p>
                                )}
                            <Button
                                shadowSize="4"
                                className="w-full"
                                onClick={() => {
                                    setLimitedOpen(false)
                                    choose(limited.choice, limited.source)
                                }}
                                data-testid="verify-id-limited-continue"
                            >
                                {t('continue')}
                            </Button>
                            <Button
                                variant="secondary"
                                shadowSize="4"
                                className="w-full"
                                onClick={() => setLimitedOpen(false)}
                                data-testid="verify-id-limited-back"
                            >
                                {t('documentList.chooseAnother')}
                            </Button>
                        </div>
                    )}
                </DrawerContent>
            </Drawer>
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
