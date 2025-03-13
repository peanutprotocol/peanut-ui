'use client'

import StatusViewWrapper from '@/components/Global/StatusViewWrapper'

export const NotFoundClaimLink = () => {
    return (
        <StatusViewWrapper
            title="Sorryyy"
            description="This link is malformed. Are you sure you copied it correctly?"
            supportCtaText="Deposit not found. Are you sure your link is correct?"
        />
    )
}
