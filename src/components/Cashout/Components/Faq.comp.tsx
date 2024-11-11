import MoreInfo from '@/components/Global/MoreInfo'
import { TOOLTIPS } from '@/constants/tooltips'

export const FAQComponent = () => {
    return (
        <div className="flex w-full items-center justify-start gap-1">
            FAQ <MoreInfo text={TOOLTIPS.CASHOUT_FAQ} />
        </div>
    )
}
