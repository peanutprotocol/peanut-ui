'use client'

import { PixNewKeyFlow } from '@/features/pix/components/PixNewKeyFlow'

/**
 * A new own Pix key for a withdrawal the bank refused (`?intentId=`). Not
 * behind the Brazil pause or a provider's rollout: it only returns the user's
 * own money, and the API keeps its route open for the same reason.
 */
export default function NewPixKeyPage() {
    return <PixNewKeyFlow />
}
