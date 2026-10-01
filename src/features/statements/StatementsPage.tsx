'use client'

import { useMemo, type ReactNode } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { BaseSelect } from '@/components/0_Bruddle/BaseSelect'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Field } from '@/components/0_Bruddle/Field'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useToast } from '@/components/0_Bruddle/Toast'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'
import { twMerge } from '@/utils/tw'
import { CustomPeriodDrawer } from './components/CustomPeriodDrawer'
import { STATEMENT_FORMATS } from './statementDownload.utils'
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
                <Field label={t('format')}>
                    {/* ListItem rows. The chosen one follows design.md's selected-rows
                        ruling (2026-09-21): action-primary fill, over-colour ink on
                        every line and the 20px check, so colour never marks it alone.
                        The native radios under the rows give the list radio semantics
                        and arrow keys, the way Checkbox keeps its input. Each label is
                        `relative` to hold its sr-only input, so the focused row lifts
                        above the next one, which would paint over its ring; `isolate`
                        keeps that lift inside the list (the Tabs pattern). */}
                    <div role="radiogroup" aria-label={t('format')} className="isolate">
                        {STATEMENT_FORMATS.map((option, index) => {
                            const checked = option === format
                            const paint = checked ? 'text-foreground-over-color-primary' : undefined
                            return (
                                <label key={option} className="relative block focus-within:z-10">
                                    <input
                                        type="radio"
                                        name="statement-format"
                                        value={option}
                                        checked={checked}
                                        onChange={() => void setFormat(option)}
                                        className="peer sr-only"
                                    />
                                    <ListItem
                                        position={getCardPosition(index, STATEMENT_FORMATS.length)}
                                        // the ring's colour is set at rest, so transition-colors
                                        // cannot animate it in from black
                                        className={twMerge(
                                            'cursor-pointer outline-action-focus transition-colors duration-instant peer-focus-visible:outline-[3px] active:bg-background-disabled',
                                            checked && 'bg-action-primary'
                                        )}
                                        title={
                                            <span className={twMerge('text-body-m text-foreground-primary', paint)}>
                                                {option.toUpperCase()}
                                            </span>
                                        }
                                        body={<span className={paint}>{t(`formatHints.${option}`)}</span>}
                                        trailing={
                                            checked ? <Icon name="check" size={20} className={paint} /> : undefined
                                        }
                                    />
                                </label>
                            )
                        })}
                    </div>
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
