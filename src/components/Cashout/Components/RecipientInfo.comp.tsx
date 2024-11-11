import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import { TOOLTIPS } from '@/constants/tooltips'

export const RecipientInfoComponent = ({ className }: { className?: string }) => {
    return (
        <div className={`flex w-full items-center justify-start gap-1 text-left text-h8 ${className}`}>
            Recipient account: <MoreInfo text={TOOLTIPS.RECIPIENT_INFO} html={true} />
        </div>
    )
}
