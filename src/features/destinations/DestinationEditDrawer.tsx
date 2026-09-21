'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'

/**
 * What the drawer needs to rename one destination. The adapter that builds it
 * knows which table the row lives in; the drawer never does.
 */
export interface EditableDestination {
    id: string
    /** The name the user gave it, empty when they gave none. */
    name: string
    /** The identifier shown under the title, already masked or shortened. */
    identifier: string
    /** How long a name the table accepts. */
    maxLength: number
    rename: (id: string, name: string) => Promise<unknown>
    /** Only where the table allows it — the button is hidden otherwise. */
    remove?: (id: string) => Promise<unknown>
    removeLabel?: string
}

interface DestinationEditDrawerProps {
    destination: EditableDestination | null
    onClose: () => void
}

/** Rename — and where the table allows it, delete — one saved destination. */
export default function DestinationEditDrawer({ destination, onClose }: DestinationEditDrawerProps) {
    const t = useTranslations('global')
    const tCommon = useTranslations('common')
    const [name, setName] = useState('')
    const [busy, setBusy] = useState<'rename' | 'delete' | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        if (destination) {
            setName(destination.name)
            setFailed(false)
        }
    }, [destination])

    const trimmed = name.trim()
    const canSave = !!destination && trimmed !== destination.name.trim()

    const run = async (kind: 'rename' | 'delete', fn: () => Promise<unknown>) => {
        setBusy(kind)
        setFailed(false)
        try {
            await fn()
            onClose()
        } catch (error) {
            // keep the drawer open so the user sees the write did not land
            console.error('[destinations] edit failed:', error)
            setFailed(true)
        } finally {
            setBusy(null)
        }
    }

    return (
        <Drawer open={!!destination} dismissible={!busy} onOpenChange={(open) => !open && !busy && onClose()}>
            <DrawerContent>
                <div className="flex flex-col gap-4 px-4 pt-1 pb-6">
                    <DrawerHeader className="w-full gap-1 p-0 text-left sm:text-left">
                        <DrawerTitle className="text-heading-card text-foreground-primary">
                            {t('savedDestinations.editTitle')}
                        </DrawerTitle>
                        <DrawerDescription className="text-body-s text-foreground-secondary">
                            {destination?.identifier ?? ''}
                        </DrawerDescription>
                    </DrawerHeader>
                    <label className="flex flex-col gap-1">
                        <span className="text-label-m text-foreground-primary">{t('savedDestinations.nameLabel')}</span>
                        <BaseInput
                            value={name}
                            maxLength={destination?.maxLength}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('savedDestinations.namePlaceholder')}
                            rightContent={
                                <span className="text-body-xs text-foreground-secondary">
                                    {name.length}/{destination?.maxLength ?? 0}
                                </span>
                            }
                        />
                    </label>
                    <Button
                        variant="primary"
                        shadowSize="4"
                        className="w-full"
                        disabled={!canSave || !!busy}
                        loading={busy === 'rename'}
                        onClick={() => destination && run('rename', () => destination.rename(destination.id, trimmed))}
                    >
                        {tCommon('save')}
                    </Button>
                    {failed && <Notification priority="error">{t('savedDestinations.editFailed')}</Notification>}
                    {destination?.remove && (
                        <Button
                            variant="stroke"
                            className="w-full"
                            icon="trash"
                            disabled={!!busy}
                            loading={busy === 'delete'}
                            onClick={() =>
                                destination.remove && run('delete', () => destination.remove!(destination.id))
                            }
                        >
                            {destination.removeLabel ?? t('savedDestinations.deleteCta')}
                        </Button>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
