'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import Badge, { type StatusType } from '@/components/Global/Badges/Badge'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { residenceCopyVariant } from '@/components/Kyc/unlock-checklist.utils'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import type { KycIntentKey } from '@/services/kyc-intents'
import type { SetupRow, SetupRowState } from '@/utils/one-shot-setup.utils'

interface OneShotSetupDrawerProps {
    open: boolean
    /** ISO-2 declared residence: names the local bank transfers and draws their flag. */
    residence: string
    rows: SetupRow[]
    onClose: () => void
    /** Every feature is available: the flow completes. */
    onContinue: () => void
}

// design.md badges: processing is in progress on our side, pending waits on
// someone else, completed is done. A state item 9b adds needs its line here.
const STATE_BADGE: Record<SetupRowState, { status: StatusType; label: 'settingUp' | 'available' | 'underReview' }> = {
    'setting-up': { status: 'processing', label: 'settingUp' },
    'under-review': { status: 'pending', label: 'underReview' },
    available: { status: 'completed', label: 'available' },
}

/**
 * The setup status after a one-shot SDK session (TASK-23329, item 9a): one
 * row per feature the user ticked, named as on the unlock checklist, with the
 * state its rails give it. It stands in for the progress modal and its Bridge
 * terms phase.
 */
export const OneShotSetupDrawer = ({ open, residence, rows, onClose, onContinue }: OneShotSetupDrawerProps) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const variant = residenceCopyVariant(residence)
    const done = rows.length > 0 && rows.every((row) => row.state === 'available')

    // the titles and leading slots of UnlockChecklistStep's rows
    const rowTitle = (key: KycIntentKey) =>
        key === 'local' ? t(`unlock.rows.local.${variant}`) : t(`unlock.rows.${key}`)
    const rowLeading = (key: KycIntentKey) => {
        if (key === 'local') return <CorridorFlag iso2={residence} />
        const concept = key === 'qr' ? 'qrPay' : key === 'card' ? 'card' : 'bank'
        return <IconBubble {...CONCEPT_ICONS[concept]} size="s" />
    }
    // the progress modal's way out while something is still pending
    const leave = () => {
        onClose()
        router.push('/home')
    }

    return (
        <Drawer
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col gap-6 pt-1 pb-6" data-testid="one-shot-setup">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <IconBubble icon={done ? 'check' : 'clock'} color={done ? 'green' : 'yellow'} />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{done ? t('progress.completeTitle') : t('setup.settingUp')}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <ListGroup className="flex flex-col">
                        {rows.map(({ key, state }) => (
                            <ListItem
                                key={key}
                                leading={rowLeading(key)}
                                title={rowTitle(key)}
                                data-testid={`setup-row-${key}`}
                                trailing={
                                    <Badge
                                        status={STATE_BADGE[state].status}
                                        customText={t(`setup.${STATE_BADGE[state].label}`)}
                                    />
                                }
                            />
                        ))}
                    </ListGroup>
                    <Button variant="primary" shadowSize="4" className="w-full" onClick={done ? onContinue : leave}>
                        {tCommon(done ? 'continue' : 'goToHome')}
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
