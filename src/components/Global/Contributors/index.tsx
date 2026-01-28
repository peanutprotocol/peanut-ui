import { type ChargeEntry } from '@/services/services.types'
import { getContributorsFromCharge } from '@/utils/general.utils'
import ContributorCard from './ContributorCard'
import { getCardPosition } from '../Card/card.utils'

const Contributors = ({ charges }: { charges: ChargeEntry[] }) => {
    const contributors = getContributorsFromCharge(charges)

    return (
        <div>
            <h2 className="text-base font-bold text-black">Contributors ({contributors.length})</h2>
            {contributors.map((contributor, index) => (
                <ContributorCard
                    position={getCardPosition(index, contributors.length)}
                    key={contributor.uuid}
                    contributor={contributor}
                />
            ))}
        </div>
    )
}

export default Contributors
