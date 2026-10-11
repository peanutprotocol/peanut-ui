'use client'

import BalanceWarningDrawer from '@/components/Global/BalanceWarningDrawer'
import type { AskSurfaceProps } from '../types'

/** The only way out is the slide; the ask's 21-day expiry brings it back. */
export default function BalanceBackupSurface({ onDismissed }: AskSurfaceProps) {
    return <BalanceWarningDrawer visible onCloseAction={onDismissed} />
}
