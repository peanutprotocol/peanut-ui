import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import Image from 'next/image'

/**
 * ListItem leading for a corridor row. The list-item usage board
 * (17312:136171) lists a flag as a valid leading but no flag primitive
 * exists, so this mirrors the shipped `AddWithdrawCountriesList` leading:
 * one 32px round image, no overlay. Flagged in the PR, not invented.
 */
export function CorridorFlag({ iso2 }: { iso2: string }) {
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
