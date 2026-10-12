'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Modal from '@/components/Global/Modal'
import { Button } from '@/components/0_Bruddle/Button'
import type { KycDocumentChoice, KycDocumentPlan, KycFeatures } from '@/app/actions/types/kyc-workflow.types'
import { identityDocuments } from '@/utils/kyc-document-plan.utils'

type KycRoute = KycDocumentPlan['routes'][number]

export function KycDocumentSelectionModal({
    plan,
    preferencesOnly = false,
    busy,
    error,
    onClose,
    onFeatures,
    onConfirm,
}: {
    plan: KycDocumentPlan
    preferencesOnly?: boolean
    busy: boolean
    error: string | null
    onClose: () => void
    onFeatures: (features: KycFeatures) => Promise<void>
    onConfirm: (routeId: string, documents: KycDocumentChoice[], features?: KycFeatures) => Promise<void>
}) {
    const t = useTranslations('kyc.documents')
    const locale = useLocale()
    const [routeId, setRouteId] = useState(plan.routes[0]?.id ?? '')
    const [choices, setChoices] = useState<KycDocumentChoice[]>([])
    // An approved user's saved features enrol providers, so they are only sent on Continue.
    const [draftFeatures, setDraftFeatures] = useState(plan.features)
    const features = preferencesOnly ? draftFeatures : plan.features
    const route = plan.routes.find((r) => r.id === routeId)
    const documents = identityDocuments(route)
    const choicesRouteRef = useRef<string | undefined>(undefined)
    useEffect(() => {
        setRouteId((id) => (plan.routes.some((r) => r.id === id) ? id : (plan.routes[0]?.id ?? '')))
        setDraftFeatures(plan.features)
    }, [plan])
    useEffect(() => {
        // A feature toggle re-plans the same route; only switching routes discards what was chosen.
        const sameRoute = choicesRouteRef.current === route?.id
        choicesRouteRef.current = route?.id
        const keep = (value: string | undefined, allowed: string[]) =>
            value && allowed.includes(value) ? value : allowed.length === 1 ? allowed[0] : ''
        setChoices((current) =>
            identityDocuments(route).map((d) => {
                const previous = sameRoute ? current.find((c) => c.key === d.key) : undefined
                return {
                    key: d.key,
                    type: keep(previous?.type, d.types),
                    issuingCountry: keep(previous?.issuingCountry, d.countries),
                }
            })
        )
    }, [route])
    const countryNames = new Intl.DisplayNames([locale], { type: 'region' })
    const countryName = (country: string) => countryNames.of(country) ?? country
    const collator = new Intl.Collator(locale)
    const byName = (countries: string[]) =>
        [...countries].sort((a, b) => collator.compare(countryName(a), countryName(b)))
    const documentName = (type: string) => {
        const keys = {
            PASSPORT: 'passport',
            ID_CARD: 'idCard',
            DRIVERS: 'drivers',
            RESIDENCE_PERMIT: 'residencePermit',
        } as const
        return t(keys[type as keyof typeof keys] ?? 'otherDocument')
    }
    const routeLabels = plan.routes.map(
        (r) =>
            `${t('identity')} — ${identityDocuments(r)
                .map((d) => d.types.map(documentName).join(' / '))
                .join(' + ')}`
    )
    const routeOptionLabel = (r: KycRoute, index: number) => {
        const label = routeLabels[index]
        if (routeLabels.filter((l) => l === label).length < 2) return label
        const countries = byName([...new Set(identityDocuments(r).flatMap((d) => d.countries))])
        return `${label} (${countries.map(countryName).join(', ')})`
    }
    const update = (key: string, value: Partial<KycDocumentChoice>) =>
        setChoices((current) => current.map((c) => (c.key === key ? { ...c, ...value } : c)))
    const ready =
        (preferencesOnly ||
            (documents.length > 0 &&
                choices.length === documents.length &&
                choices.every((c) => c.type && c.issuingCountry))) &&
        Object.values(features).some(Boolean)
    return (
        <Modal
            visible
            onClose={onClose}
            preventClose={busy}
            title={t(preferencesOnly ? 'preferencesTitle' : 'title')}
            closeTestId="kyc-documents-close"
            // Taller than a phone screen: bounded to it, the body scrolls and the title and close stay on screen.
            classWrap="flex max-h-[calc(100dvh_-_var(--safe-top))] flex-col md:max-h-[calc(100dvh_-_3rem)]"
            classNameWrapperDiv="min-h-0 flex-1 overflow-y-auto"
        >
            <form
                className="flex flex-col gap-6 p-6"
                onSubmit={(e) => {
                    e.preventDefault()
                    if (!ready) return
                    void (preferencesOnly ? onConfirm('', [], draftFeatures) : onConfirm(routeId, choices))
                }}
            >
                <p>{t(preferencesOnly ? 'preferencesDescription' : 'description')}</p>
                <fieldset aria-busy={busy} className="flex flex-col gap-2">
                    <legend className="mb-2 font-semibold">{t('features')}</legend>
                    {(['qr', 'local', 'bank', 'card'] as const).map((feature) => (
                        <label className="flex min-h-11 items-center gap-3" key={feature}>
                            <input
                                type="checkbox"
                                data-testid={`kyc-documents-feature-${feature}`}
                                checked={features[feature]}
                                onChange={(e) => {
                                    if (busy) return
                                    const next = { ...features, [feature]: e.target.checked }
                                    if (preferencesOnly) setDraftFeatures(next)
                                    else void onFeatures(next)
                                }}
                            />
                            {t(feature)}
                        </label>
                    ))}
                </fieldset>
                {!preferencesOnly && !plan.routes.length && <p role="status">{t('unavailable')}</p>}
                {!preferencesOnly && plan.routes.length > 1 && (
                    <label className="flex flex-col gap-2">
                        {t('documentSet')}
                        <select
                            className="min-h-11 rounded-sm border border-border-default p-3"
                            data-testid="kyc-documents-route"
                            disabled={busy}
                            value={routeId}
                            onChange={(e) => setRouteId(e.target.value)}
                        >
                            {plan.routes.map((r, index) => (
                                <option key={r.id} value={r.id}>
                                    {routeOptionLabel(r, index)}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {!preferencesOnly &&
                    documents.map((d) => {
                        const choice = choices.find((c) => c.key === d.key)
                        return (
                            <fieldset disabled={busy} className="flex flex-col gap-3" key={d.key}>
                                <legend className="mb-2 font-semibold">{t('identity')}</legend>
                                <label className="flex flex-col gap-2">
                                    {t('documentType')}
                                    <select
                                        className="min-h-11 rounded-sm border border-border-default p-3"
                                        data-testid="kyc-documents-type"
                                        required
                                        value={choice?.type ?? ''}
                                        onChange={(e) => update(d.key, { type: e.target.value })}
                                    >
                                        <option value="" disabled>
                                            {t('choose')}
                                        </option>
                                        {d.types.map((type) => (
                                            <option key={type} value={type}>
                                                {documentName(type)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex flex-col gap-2">
                                    {t('issuingCountry')}
                                    <select
                                        className="min-h-11 rounded-sm border border-border-default p-3"
                                        data-testid="kyc-documents-country"
                                        required
                                        value={choice?.issuingCountry ?? ''}
                                        onChange={(e) => update(d.key, { issuingCountry: e.target.value })}
                                    >
                                        <option value="" disabled>
                                            {t('choose')}
                                        </option>
                                        {byName(d.countries).map((country) => (
                                            <option key={country} value={country}>
                                                {countryName(country)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </fieldset>
                        )
                    })}
                {error && <p role="alert">{error}</p>}
                <Button type="submit" disabled={busy || !ready} data-testid="kyc-documents-continue">
                    {t(preferencesOnly ? 'preferencesContinue' : 'continue')}
                </Button>
            </form>
        </Modal>
    )
}
