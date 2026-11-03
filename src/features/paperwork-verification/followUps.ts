import type { NextAction } from '@/types/capabilities'
import { isCardDocumentTask } from '@/utils/bridge-tasks.utils'
import type { FollowUpLabel } from './components/StepsScreen'

/** A step a feature still asks for once the identity is verified, as the verified timeline shows it. */
export interface FollowUpStep {
    label: FollowUpLabel
    /** the sentence Home's task card says about it, under the timeline's title */
    note:
        | 'home.pendingTasks.cardAddressDescription'
        | 'home.pendingTasks.cardIdentityDescription'
        | 'home.pendingTasks.tosDescription'
        | 'home.pendingTasks.verifyDescription'
        | 'home.pendingTasks.documentDescription'
        | 'kyc.setup.documentDescription'
    href: string
}

/**
 * Where each step is done: the card's on /card, which holds the upload; a bank's on
 * Home, whose task card runs its flow (the document, the terms, the partner's own check).
 */
export function followUpStep(task: NextAction): FollowUpStep {
    if (isCardDocumentTask(task)) {
        const identity = task.kind === 'rain-hosted' || task.kind === 'restart-identity'
        return identity
            ? { label: 'cardIdentity', note: 'home.pendingTasks.cardIdentityDescription', href: '/card' }
            : { label: 'cardAddress', note: 'home.pendingTasks.cardAddressDescription', href: '/card' }
    }
    if (task.kind === 'accept-tos')
        return { label: 'bankTerms', note: 'home.pendingTasks.tosDescription', href: '/home' }
    if (task.kind === 'sumsub')
        return {
            label: 'bankDocument',
            // a dated request keeps a working account; an undated one finishes opening it
            note: task.effectiveDate ? 'home.pendingTasks.documentDescription' : 'kyc.setup.documentDescription',
            href: '/home',
        }
    return { label: 'bankCheck', note: 'home.pendingTasks.verifyDescription', href: '/home' }
}
