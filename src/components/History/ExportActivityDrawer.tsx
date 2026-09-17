'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import SegmentedControl from '@/components/0_Bruddle/SegmentedControl'
import { useToast } from '@/components/0_Bruddle/Toast'
import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import { useAuth } from '@/context/authContext'
import { useHistoryRange } from '@/hooks/useHistoryRange'
import { useHistoryRangeLabel } from '@/hooks/useHistoryRangeLabel'
import {
    prepareActivityExport,
    saveActivityExport,
    type ActivityExportFormat,
    type ActivityExportFile,
} from '@/utils/activityExport.utils'
import { isCapacitor } from '@/utils/capacitor'
import { Notification } from '@/components/0_Bruddle/Notification'
import { HistoryRangeDrawer } from './HistoryRangeDrawer'

interface ExportActivityDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const FORMAT_OPTIONS: { value: ActivityExportFormat; label: string }[] = [
    { value: 'pdf', label: 'PDF' },
    { value: 'csv', label: 'CSV' },
    { value: 'xlsx', label: 'XLSX' },
]

/**
 * Export the activity history as a file. Format via SegmentedControl, range
 * via the shared timeframe drawer (nested), download over authed fetch —
 * native delivery uses a fresh tap after file preparation.
 */
export const ExportActivityDrawer = ({ open, onOpenChange }: ExportActivityDrawerProps) => {
    const t = useTranslations('history')
    const toast = useToast()
    const { user } = useAuth()
    const { fromIso, toIso } = useHistoryRange()
    const rangeLabel = useHistoryRangeLabel()
    const [format, setFormat] = useState<ActivityExportFormat>('pdf')
    const [rangeOpen, setRangeOpen] = useState(false)
    const [isExporting, setIsExporting] = useState(false)

    const [prepared, setPrepared] = useState<ActivityExportFile | null>(null)
    const [error, setError] = useState<string | null>(null)
    const busy = useRef(false)
    const mounted = useRef(false)
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])
    const identity = `${user?.user.userId}:${open}:${format}:${fromIso}:${toIso}`
    const identityRef = useRef(identity)
    identityRef.current = identity
    useEffect(() => {
        setPrepared(null)
        setError(null)
    }, [identity])

    const handleDownload = async () => {
        if (busy.current) return
        busy.current = true
        setIsExporting(true)
        setError(null)
        const current = identity
        try {
            let file = prepared
            if (!file) {
                file = await prepareActivityExport({ format, fromIso, toIso })
                if (!mounted.current || identityRef.current !== current) return
                setPrepared(file)
                // The second tap opens the native share sheet with active user consent.
                if (isCapacitor()) return
            }
            const result = await saveActivityExport(file)
            if (result === 'saved' && mounted.current && identityRef.current === current) {
                toast.success(t('export.success'))
                onOpenChange(false)
            }
        } catch (cause) {
            if (!mounted.current || identityRef.current !== current) return
            const key = (
                {
                    EXPORT_TOO_LARGE: 'tooLarge',
                    EXPORT_UNVERIFIED: 'unverified',
                    EXPORT_BUSY: 'busy',
                    EXPORT_SAVE_UNAVAILABLE: 'saveUnavailable',
                } as Record<string, 'tooLarge' | 'unverified' | 'busy' | 'saveUnavailable'>
            )[cause instanceof Error ? cause.message : 'EXPORT_FAILED']
            setError(t(key ? `export.${key}` : 'export.error'))
        } finally {
            busy.current = false
            if (mounted.current) setIsExporting(false)
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
                        body={rangeLabel}
                        chevron
                        onClick={() => setRangeOpen(true)}
                    />
                    {error && <Notification priority="error">{error}</Notification>}
                    <Button variant="purple" className="w-full" loading={isExporting} onClick={handleDownload}>
                        {t(prepared && isCapacitor() ? 'export.save' : 'export.download')}
                    </Button>
                </div>
                <HistoryRangeDrawer nested open={rangeOpen} onOpenChange={setRangeOpen} />
            </DrawerContent>
        </Drawer>
    )
}
