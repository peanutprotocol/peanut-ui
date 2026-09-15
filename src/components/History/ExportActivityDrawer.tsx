'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import SegmentedControl from '@/components/0_Bruddle/SegmentedControl'
import { useToast } from '@/components/0_Bruddle/Toast'
import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import { useHistoryRange } from '@/hooks/useHistoryRange'
import { useHistoryRangeLabel } from '@/hooks/useHistoryRangeLabel'
import { downloadActivityExport, type ActivityExportFormat } from '@/utils/activityExport.utils'
import { HistoryRangeDrawer } from './HistoryRangeDrawer'

interface ExportActivityDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const FORMAT_OPTIONS: { value: ActivityExportFormat; label: string }[] = [
    { value: 'csv', label: 'CSV' },
    { value: 'pdf', label: 'PDF' },
    { value: 'xlsx', label: 'XLSX' },
]

/**
 * Export the activity history as a file. Format via SegmentedControl, range
 * via the shared timeframe drawer (nested), download over authed fetch —
 * see downloadActivityExport for the web/native delivery split.
 */
export const ExportActivityDrawer = ({ open, onOpenChange }: ExportActivityDrawerProps) => {
    const t = useTranslations('history')
    const toast = useToast()
    const { fromIso, toIso } = useHistoryRange()
    const rangeLabel = useHistoryRangeLabel()
    const [format, setFormat] = useState<ActivityExportFormat>('csv')
    const [rangeOpen, setRangeOpen] = useState(false)
    const [isExporting, setIsExporting] = useState(false)

    const handleDownload = async () => {
        setIsExporting(true)
        try {
            await downloadActivityExport({ format, fromIso, toIso })
            toast.success(t('export.success'))
            onOpenChange(false)
        } catch (error) {
            toast.error(error instanceof Error && error.message ? error.message : t('export.error'))
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent accessibleTitle={t('export.title')} className="py-4">
                <div className="flex flex-col gap-4 pb-2">
                    <div className="text-center text-heading-xs">{t('export.title')}</div>
                    <SegmentedControl
                        aria-label={t('export.format')}
                        fullWidth
                        value={format}
                        onChange={(value) => setFormat(value as ActivityExportFormat)}
                        options={FORMAT_OPTIONS}
                    />
                    <ListItem
                        position="single"
                        leading={<IconBubble icon="calendar" size="s" />}
                        title={t('export.range')}
                        trailing={<span className="text-body-s text-foreground-secondary">{rangeLabel}</span>}
                        chevron
                        onClick={() => setRangeOpen(true)}
                    />
                    <Button variant="purple" className="w-full" loading={isExporting} onClick={handleDownload}>
                        {t('export.download')}
                    </Button>
                </div>
                <HistoryRangeDrawer nested open={rangeOpen} onOpenChange={setRangeOpen} />
            </DrawerContent>
        </Drawer>
    )
}
