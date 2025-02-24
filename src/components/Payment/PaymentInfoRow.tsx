import { twMerge } from 'tailwind-merge'
import MoreInfo from '../Global/MoreInfo'

// todo: temprorary declaring infor row here, need to update the old info row component and use it
export const PaymentInfoRow = ({
    label,
    value,
    moreInfoText,
    loading,
}: {
    label: string
    value: number | string | React.ReactNode
    moreInfoText?: string
    loading?: boolean
}) => (
    <div
        className={
            'flex w-full flex-col justify-between gap-1 border-b border-dashed border-black py-3 text-h8 md:flex-row md:items-center'
        }
    >
        <div className="flex items-center gap-1">
            <label className={twMerge('text-sm font-semibold text-grey-1')}>{label}</label>
        </div>
        {loading ? (
            <div className="h-2 w-12 animate-colorPulse rounded bg-slate-700" />
        ) : (
            <div className="flex items-center gap-1">
                <div className={twMerge('flex w-fit justify-end text-sm font-semibold')}>
                    <span>{value}</span>
                </div>
                {moreInfoText && <MoreInfo text={moreInfoText} />}
            </div>
        )}
    </div>
)
