'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Modal from '@/components/Global/Modal'
import { Button } from '@/components/0_Bruddle/Button'
import type { KycDocumentChoice, KycDocumentPlan, KycFeatures } from '@/app/actions/types/kyc-workflow.types'

export function KycDocumentSelectionModal({
    plan,
    busy,
    error,
    onClose,
    onFeatures,
    onConfirm,
}: {
    plan: KycDocumentPlan
    busy: boolean
    error: string | null
    onClose: () => void
    onFeatures: (features: KycFeatures) => Promise<void>
    onConfirm: (routeId: string, documents: KycDocumentChoice[]) => Promise<void>
}) {
    const t = useTranslations('kyc.documents')
    const locale = useLocale()
    const [routeId, setRouteId] = useState(plan.routes[0]?.id ?? '')
    const [choices, setChoices] = useState<KycDocumentChoice[]>([])
    const route = plan.routes.find((r) => r.id === routeId)
    useEffect(() => {
        setRouteId(plan.routes[0]?.id ?? '')
    }, [plan])
    useEffect(() => {
        setChoices(
            route?.documents.map((d) => ({
                key: d.key,
                type: d.types.length === 1 ? d.types[0] : '',
                issuingCountry: d.countries.length === 1 ? d.countries[0] : '',
            })) ?? []
        )
    }, [route])
    const countryNames = new Intl.DisplayNames([locale], { type: 'region' })
    const documentName = (type: string) => {
        const keys = {
            PASSPORT: 'passport',
            ID_CARD: 'idCard',
            DRIVERS: 'drivers',
            RESIDENCE_PERMIT: 'residencePermit',
            BANK_STATEMENT: 'bankStatement',
            UTILITY_BILL: 'utilityBill',
        } as const
        return t(keys[type as keyof typeof keys] ?? 'otherDocument')
    }
    const update = (key: string, value: Partial<KycDocumentChoice>) =>
        setChoices((current) => current.map((c) => (c.key === key ? { ...c, ...value } : c)))
    const ready =
        !!route &&
        choices.length === route.documents.length &&
        choices.every((c) => c.type && c.issuingCountry) &&
        Object.values(plan.features).some(Boolean)
    return (
        <Modal visible onClose={onClose} preventClose={busy} title={t('title')}>
            <form
                className="flex flex-col gap-5 p-5"
                onSubmit={(e) => {
                    e.preventDefault()
                    if (ready) void onConfirm(routeId, choices)
                }}
            >
                <p>{t('description')}</p>
                <fieldset disabled={busy} className="flex flex-col gap-2">
                    <legend className="mb-2 font-semibold">{t('features')}</legend>
                    {(['qr', 'local', 'bank', 'card'] as const).map((feature) => (
                        <label className="flex min-h-11 items-center gap-3" key={feature}>
                            <input
                                type="checkbox"
                                checked={plan.features[feature]}
                                onChange={(e) => void onFeatures({ ...plan.features, [feature]: e.target.checked })}
                            />
                            {t(feature)}
                        </label>
                    ))}
                </fieldset>
                {!plan.routes.length && <p role="status">{t('unavailable')}</p>}
                {plan.routes.length > 1 && (
                    <label className="flex flex-col gap-2">
                        {t('documentSet')}
                        <select
                            className="min-h-11 rounded-xl border border-black p-3"
                            disabled={busy}
                            value={routeId}
                            onChange={(e) => setRouteId(e.target.value)}
                        >
                            {plan.routes.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.documents.map((d) => t(d.code === 'IDENTITY' ? 'identity' : 'poa')).join(' + ')}{' '}
                                    {'— '}
                                    {r.documents.map((d) => d.types.map(documentName).join(' / ')).join(' + ')}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {route?.documents.map((d) => {
                    const choice = choices.find((c) => c.key === d.key)
                    return (
                        <fieldset disabled={busy} className="flex flex-col gap-3" key={d.key}>
                            <legend className="mb-2 font-semibold">
                                {t(d.code === 'IDENTITY' ? 'identity' : 'poa')}
                            </legend>
                            <label className="flex flex-col gap-2">
                                {t('documentType')}
                                <select
                                    className="min-h-11 rounded-xl border border-black p-3"
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
                                    className="min-h-11 rounded-xl border border-black p-3"
                                    required
                                    value={choice?.issuingCountry ?? ''}
                                    onChange={(e) => update(d.key, { issuingCountry: e.target.value })}
                                >
                                    <option value="" disabled>
                                        {t('choose')}
                                    </option>
                                    {d.countries.map((country) => (
                                        <option key={country} value={country}>
                                            {countryNames.of(country) ?? country}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </fieldset>
                    )
                })}
                {error && <p role="alert">{error}</p>}
                <Button type="submit" disabled={busy || !ready}>
                    {t('continue')}
                </Button>
            </form>
        </Modal>
    )
}
