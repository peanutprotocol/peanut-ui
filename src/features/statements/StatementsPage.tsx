'use client'

import { useMemo, type ReactNode } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { BaseSelect } from '@/components/0_Bruddle/BaseSelect'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Field } from '@/components/0_Bruddle/Field'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useToast } from '@/components/0_Bruddle/Toast'
import NavHeader from '@/components/Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'
import { CustomPeriodDrawer } from './components/CustomPeriodDrawer'
import { STATEMENT_FORMATS, type StatementFormat } from './statementDownload.utils'
import { CUSTOM_PERIOD, STATEMENT_PERIOD_PRESETS, type StatementPeriodOption } from './statementPeriod.utils'
import { useStatementDownload } from './useStatementDownload'
import { useStatementFormat } from './useStatementFormat'
import { useStatementPeriod } from './useStatementPeriod'

/**
 * Profile → Statements: pick a format and a period, then download the
 * activity file. Both live in the URL, so
 * `/profile/statements?from=2026-08-01&to=2026-08-31&format=csv` opens with
 * them chosen. "Custom period" picks its days in a drawer, so the page keeps
 * one height and Download stays under the fields.
 */
export function StatementsPage() {
    const t = useTranslations('statements')
    const formatter = useFormatter()
    const toast = useToast()
    const onBack = useSafeBack('/profile', { replace: true })
    const period = useStatementPeriod()
    const { format, setFormat } = useStatementFormat()
    const { download, isDownloading, isPrepared, periodTooLong, error } = useStatementDownload({
        format,
        from: period.from,
        to: period.to,
        fromIso: period.fromIso,
        toIso: period.toIso,
        preset: period.preset,
        onSaved: () => toast.success(t('downloaded')),
    })

    const periodOptions = useMemo(
        () => [
            ...STATEMENT_PERIOD_PRESETS.map((preset) => ({ value: preset, label: t(`periods.${preset}`) })),
            { value: CUSTOM_PERIOD, label: t('periods.custom') },
        ],
        [t]
    )

    // the exact days the file will cover; all time has none to show
    const { days } = period
    const periodDates = days?.from
        ? formatter.dateTimeRange(days.from, days.to ?? days.from, { day: 'numeric', month: 'short', year: 'numeric' })
        : undefined
    // Choosing "Custom period" again changes nothing in the select, so a custom
    // period keeps its own way back into the drawer on the line under the field,
    // next to its dates or next to the error that asks for a shorter period
    const withChangeDates = (line: ReactNode) =>
        period.isCustom ? (
            <span className="flex items-start justify-between gap-2">
                <span>{line}</span>
                <LinkButton onClick={period.openDrawer}>{t('changeDates')}</LinkButton>
            </span>
        ) : (
            line
        )

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="flex flex-col gap-6">
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
                <Field
                    label={t('period')}
                    helper={periodDates && withChangeDates(periodDates)}
                    error={periodTooLong ? withChangeDates(t('errors.tooLarge')) : undefined}
                >
                    <BaseSelect
                        aria-label={t('period')}
                        options={periodOptions}
                        value={period.option}
                        onValueChange={(value) => period.selectOption(value as StatementPeriodOption)}
                    />
                </Field>
                <CustomPeriodDrawer
                    open={period.drawerOpen}
                    days={days}
                    onApply={period.applyDays}
                    onClose={period.closeDrawer}
                />
            </div>
            <PageStack.Footer>
                <Button variant="primary" className="w-full" loading={isDownloading} onClick={download}>
                    {t(isPrepared ? 'save' : 'download')}
                </Button>
                {/* the outcome reads under the action that caused it, so the CTA
                    never jumps when the error appears */}
                {error && <Callout priority="error">{t(`errors.${error}`)}</Callout>}
            </PageStack.Footer>
        </PageStack>
    )
}
