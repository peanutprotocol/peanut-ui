'use client'

import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import { type IconName } from '@/components/Global/Icons/Icon'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

export interface ReceiptMoreAction {
    icon: IconName
    title: string
    onSelect: () => void
    disabled?: boolean
    'data-testid'?: string
}

/**
 * the receipt's action overflow (TASK-22452): secondary actions demoted out
 * of the cta stack. drawer + list recipes (design.md) — ListGroup positions,
 * ListItem rows with an IconBubble leading. the actions are plain
 * information, so their s bubbles are blue (TASK-22761). `nested` follows the CancelSendLinkDrawer pattern:
 * inside the transaction-details drawer this must be a vaul NestedRoot and
 * the parent is kept open through setIsModalOpen, wired by ReceiptActions.
 */
export function ReceiptMoreActionsDrawer({
    open,
    onOpenChange,
    nested,
    actions,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    nested: boolean
    actions: ReceiptMoreAction[]
}) {
    const t = useAppTranslations('transaction')

    return (
        <Drawer nested={nested} open={open} onOpenChange={onOpenChange}>
            <DrawerContent accessibleTitle={t('actions.moreActions')} className="py-4">
                <ListGroup>
                    {actions.map((action) => (
                        <ListItem
                            key={action.title}
                            title={action.title}
                            leading={<IconBubble icon={action.icon} color="blue" size="s" />}
                            onClick={action.onSelect}
                            disabled={action.disabled}
                            data-testid={action['data-testid']}
                        />
                    ))}
                </ListGroup>
            </DrawerContent>
        </Drawer>
    )
}
