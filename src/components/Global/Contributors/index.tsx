import { ChargeEntry } from '@/services/services.types'
import { getContributorsFromCharge } from '@/utils'
import React from 'react'

const Contributors = ({ charges }: { charges: ChargeEntry[] }) => {
    const contributors = getContributorsFromCharge(charges)

    return (
        <div>
            <h2 className="text-base font-bold text-black">Contributors ({contributors.length})</h2>
            {contributors.map((contributor) => (
                <div className="flex w-full items-center justify-between" key={contributor.uuid}>
                    <p>
                        {contributor.payments[contributor.payments.length - 1]?.payerAccount?.user?.username ??
                            'Anonymous'}
                    </p>
                    <p>{contributor.tokenAmount}</p>
                </div>
            ))}
        </div>
    )
}

export default Contributors
