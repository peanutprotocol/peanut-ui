'use client'

import RouteAlias from '@/components/Global/RouteAlias'
import { PIX_WITHDRAW_PATH } from '@/features/pix/pix.routes'

/**
 * The retired new-key page of a refused Pix payout (`?intentId=`). A refused payout now returns the
 * money to the wallet (TASK-24947), so a link already delivered opens the withdrawal's last step,
 * which reads its outcome from the same `intentId`.
 */
export default function NewPixKeyPage() {
    return <RouteAlias to={PIX_WITHDRAW_PATH} />
}
