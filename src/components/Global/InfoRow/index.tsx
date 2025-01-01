import Icon from '../Icon'
import MoreInfo from '../MoreInfo'

interface InfoRowProps {
    iconName: string
    label: string
    value: number | string
    moreInfoText: string
}

const InfoRow = ({ iconName, label, value, moreInfoText }: InfoRowProps) => (
    <div className="flex w-full items-center justify-between gap-1 px-2 text-h8 text-gray-1">
        <div className="flex items-center gap-1">
            <Icon name={iconName} className="h-4 fill-gray-1" />
            <label className="font-bold">{label}</label>
        </div>
        <div className="flex items-center gap-1">
            <div className="flex w-fit justify-end text-sm font-normal">
                <span>{value}</span>
            </div>
            <MoreInfo text={moreInfoText} />
        </div>
    </div>
)

export default InfoRow
