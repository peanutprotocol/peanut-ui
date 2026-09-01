import Image from 'next/image'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'

/**
 * ListItem leading flag — one element, 32px, round (list-item usage board
 * 17312:136171 lists a flag as a valid leading; AddWithdrawCountriesList
 * renders its leading images at h-8 w-8 rounded-full).
 */
export function Flag({ iso2 }: { iso2: string }) {
    return (
        <Image
            src={getFlagUrl(iso2)}
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-round object-cover"
        />
    )
}
