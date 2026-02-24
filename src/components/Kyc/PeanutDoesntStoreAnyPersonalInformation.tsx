import { Icon } from '@/components/Global/Icons/Icon'
import { twMerge } from 'tailwind-merge'

export const PeanutDoesntStoreAnyPersonalInformation = ({ className }: { className?: string }) => {
    return (
        <div className={twMerge('flex items-center gap-2 text-[11px] text-grey-1', className)}>
            <Icon name="info" className="h-3 w-3" />
            <span>Peanut doesn&apos;t store any of your documents</span>
        </div>
    )
}
