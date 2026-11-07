'use client'

import { AveniaNewKeyFlow } from '@/features/avenia/components/AveniaNewKeyFlow'

/**
 * A new own Pix key for a withdrawal the bank refused (`?intentId=`). Not
 * behind the Brazil pause or the Avenia rollout: it only returns the user's
 * own money, and the API keeps its route open for the same reason.
 */
export default function NewPixKeyPage() {
    return <AveniaNewKeyFlow />
}
