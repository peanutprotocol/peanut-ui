import { twMerge } from 'tailwind-merge'
import MoreInfo from '../MoreInfo'

interface InfoRowProps {
    iconName: string
    label: string
    value: number | string
    moreInfoText: string
    loading?: boolean
    smallFont?: boolean
}

const InfoRow = ({ iconName, label, value, moreInfoText, loading, smallFont }: InfoRowProps) => (
    <div className={'flex w-full items-center justify-between gap-1 text-h8'}>
        <div className="flex items-center gap-1">
            {/* todo: uncomment when icons are implemented for other fields in req view */}
            {/* <Icon name={iconName} className="h-4 fill-gray-1" /> */}
            <label className={twMerge('text-sm font-semibold text-grey-1', smallFont ? 'text-h9' : 'text-sm')}>
                {label}
            </label>
        </div>
        {loading ? (
            <div className="h-2 w-12 animate-colorPulse rounded bg-slate-700" />
        ) : (
            <div className="flex items-center gap-1">
                <div className={twMerge('flex w-fit justify-end font-semibold', smallFont ? 'text-h9' : 'text-sm')}>
                    <span>{value}</span>
                </div>
                <MoreInfo text={moreInfoText} />
            </div>
        )}
    </div>
)

export default InfoRow
