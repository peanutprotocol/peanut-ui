import { twMerge } from 'tailwind-merge'

// todo: temprorary declaring infor row here, need to update the old info row component and use it
export const PaymentInfoRow = ({
    label,
    value,
    moreInfoText,
    loading,
    hideBottomBorder,
}: {
    label: string | React.ReactNode
    value: number | string | React.ReactNode
    moreInfoText?: string
    loading?: boolean
    hideBottomBorder?: boolean
}) => (
    <div
        className={twMerge(
            'flex w-full flex-col justify-between gap-1 border-b border-dashed border-black py-3 text-h8',
            hideBottomBorder && 'border-none'
        )}
    >
        <div className="flex items-center gap-1">
            <label className={twMerge('text-xs font-semibold')}>{label}</label>
        </div>
        {loading ? (
            <div className="h-2 w-12 animate-colorPulse rounded bg-slate-700" />
        ) : (
            <div className="flex items-center gap-1">
                <div className={twMerge('flex w-fit justify-end text-sm font-bold')}>
                    <span>{value}</span>
                </div>
            </div>
        )}
    </div>
)
