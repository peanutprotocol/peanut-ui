'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { BaseSelect } from '@/components/0_Bruddle/BaseSelect'
import { Button } from '@/components/0_Bruddle/Button'
import { Calendar } from '@/components/0_Bruddle/Calendar'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Field } from '@/components/0_Bruddle/Field'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useToast } from '@/components/0_Bruddle/Toast'
import NavHeader from '@/components/Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'
import { scrollClearOfBottomNav } from '@/utils/bottom-nav-clearance.utils'
import { STATEMENT_FORMATS, type StatementFormat } from './statementDownload.utils'
import { CUSTOM_PERIOD, STATEMENT_PERIOD_PRESETS, type StatementPeriodOption } from './statementPeriod.utils'
import { useStatementDownload } from './useStatementDownload'
import { useStatementFormat } from './useStatementFormat'
import { useStatementPeriod } from './useStatementPeriod'

/**
 * Profile → Statements: pick a format and a period, then download the
 * activity file. Both live in the URL, so
 * `/profile/statements?from=2026-08-01&to=2026-08-31&format=csv` opens with
 * them chosen. "Custom period" opens the range calendar on the page, under
 * the Period field (Aleks, 2026-10-01, over a drawer): the page grows and
 * Download moves down with it, and waits until a first day is picked.
 *
 * In the app the one button is Generate; once the file is ready it gives way
 * to Share (primary) and Download (secondary) (Aleks, 2026-10-12).
 */
export function StatementsPage() {
    const t = useTranslations('statements')
    const tCommon = useTranslations('common')
    const formatter = useFormatter()
    const toast = useToast()
    const onBack = useSafeBack('/profile', { replace: true })
    const period = useStatementPeriod()
    const { format, setFormat } = useStatementFormat()
    const { generate, share, download, busy, isNative, isPrepared, periodTooLong, error } = useStatementDownload({
        format,
        from: period.from,
        to: period.to,
        fromIso: period.fromIso,
        toIso: period.toIso,
        preset: period.preset,
        onSaved: ({ byYear }, inDocuments) =>
            toast.success(inDocuments ? tCommon('savedToDocuments') : t(byYear ? 'downloadedByYear' : 'downloaded')),
    })

    const periodOptions = useMemo(
        () => [
            ...STATEMENT_PERIOD_PRESETS.map((preset) => ({ value: preset, label: t(`periods.${preset}`) })),
            { value: CUSTOM_PERIOD, label: t('periods.custom') },
        ],
        [t]
    )

    // the exact days the file will cover; all time has none to show, and a
    // custom period with no day yet says what to do on the calendar below
    const { days } = period
    const periodDates = days?.from
        ? formatter.dateTimeRange(days.from, days.to ?? days.from, { day: 'numeric', month: 'short', year: 'numeric' })
        : period.isCustom
          ? t('customPeriod.description')
          : undefined

    // the calendar makes the page longer than the screen, and the fixed bottom
    // nav then covers the buttons. When a tap gives the custom period a last
    // day, the page moves just far enough to show the last button; when a
    // failure appears under the buttons, just far enough to show the failure.
    // A deep link that opens on a period does not scroll: nothing changed.
    const lastButtonRef = useRef<HTMLButtonElement>(null)
    const errorRef = useRef<HTMLDivElement>(null)
    const lastDay = period.isCustom ? days?.to?.getTime() : undefined
    const shownLastDay = useRef(lastDay)
    useEffect(() => {
        if (lastDay !== undefined && lastDay !== shownLastDay.current) scrollClearOfBottomNav(lastButtonRef.current)
        shownLastDay.current = lastDay
    }, [lastDay])
    useEffect(() => {
        if (error) scrollClearOfBottomNav(errorRef.current)
    }, [error])

    return (
        <PageStack gap="6">
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="flex flex-col gap-6">
                <p className="text-body-s text-foreground-secondary">{t('intro')}</p>
                {/* Format and Period are the same control (Aleks, 2026-10-01): one
                    select each, the chosen format's hint on the helper line. */}
                <Field label={t('format')} helper={t(`formatHints.${format}`)}>
                    <BaseSelect
                        aria-label={t('format')}
                        options={STATEMENT_FORMATS.map((option) => ({ value: option, label: option.toUpperCase() }))}
                        value={format}
                        onValueChange={(value) => void setFormat(value as StatementFormat)}
                    />
                </Field>
                <div className="flex flex-col gap-3">
                    <Field
                        label={t('period')}
                        helper={periodDates}
                        error={periodTooLong ? t('errors.tooLarge') : undefined}
                    >
                        <BaseSelect
                            aria-label={t('period')}
                            options={periodOptions}
                            value={period.option}
                            onValueChange={(value) => period.selectOption(value as StatementPeriodOption)}
                        />
                    </Field>
                    {period.isCustom && (
                        <Calendar selected={days} onSelect={period.selectDays} defaultMonth={days?.from} />
                    )}
                </div>
            </div>
            <PageStack.Footer>
                {/* the CTA ends the page (design.md "pinned footer CTA") and a
                    failure reads just under it (Aleks, 2026-10-12), so the
                    bottom-nav clearance lands on the failure when there is one.
                    The refused-file error keeps its line short and asks for
                    support through the link alone. */}
                {isPrepared ? (
                    <>
                        <Button
                            variant="primary"
                            className="w-full"
                            loading={busy === 'share'}
                            disabled={busy === 'download'}
                            onClick={share}
                        >
                            {t('share')}
                        </Button>
                        <Button
                            ref={lastButtonRef}
                            variant="secondary"
                            className="w-full"
                            loading={busy === 'download'}
                            disabled={busy === 'share'}
                            onClick={download}
                        >
                            {t('download')}
                        </Button>
                    </>
                ) : (
                    <Button
                        ref={lastButtonRef}
                        variant="primary"
                        className="w-full"
                        loading={busy === 'generate'}
                        disabled={!period.isComplete}
                        onClick={generate}
                    >
                        {t(isNative ? 'generate' : 'download')}
                    </Button>
                )}
                {error && (
                    <div ref={errorRef}>
                        <Callout priority="error" offerSupport={error === 'unverified'}>
                            {t(`errors.${error}`)}
                        </Callout>
                    </div>
                )}
            </PageStack.Footer>
        </PageStack>
    )
}
