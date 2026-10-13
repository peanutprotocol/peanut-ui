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
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import type { KycFeatureKey, SetupRow, SetupRowState } from '@/utils/kyc-setup-status.utils'

interface KycSetupStatusDrawerProps {
    open: boolean
    /** ISO-2 residence: draws the flag of the local bank transfers. */
    residence: string | null
    rows: SetupRow[]
    onClose: () => void
    /** Every feature is available: the flow completes. */
    onContinue: () => void
}

// design.md badges: processing is in progress on our side, pending waits on
// someone else, completed is done.
const STATE_BADGE: Record<SetupRowState, { status: StatusType; label: 'settingUp' | 'available' | 'underReview' }> = {
    'setting-up': { status: 'processing', label: 'settingUp' },
    'under-review': { status: 'pending', label: 'underReview' },
    available: { status: 'completed', label: 'available' },
}

/**
 * The setup status after a document-first identity check: one row per
 * feature saved on the document list, named as the list names it, with the
 * state its rails give it. It stands in for the progress modal. Ported from
 * the one-shot setup drawer (#3581).
 */
export const KycSetupStatusDrawer = ({ open, residence, rows, onClose, onContinue }: KycSetupStatusDrawerProps) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const done = rows.length > 0 && rows.every((row) => row.state === 'available')

    const rowLeading = (key: KycFeatureKey) => {
        if (key === 'local' && residence) return <CorridorFlag iso2={residence} />
        const concept = key === 'qr' ? 'qrPay' : key === 'card' ? 'card' : 'bank'
        return <IconBubble {...CONCEPT_ICONS[concept]} size="s" />
    }
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
                <div className="flex flex-col gap-6 pt-1 pb-6" data-testid="kyc-setup-status">
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
                                title={t(`documents.${key}`)}
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
