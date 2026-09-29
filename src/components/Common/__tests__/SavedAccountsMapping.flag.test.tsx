/**
 * A saved account names its country by a three-letter code, and the flag asset
 * is named by the two-letter one. The alpha-3 table covers the SEPA and Manteca
 * countries alone, so a Mexican account asked for /flags/mex.svg and showed a
 * broken image.
 */
import { render } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { AccountType, type Account } from '@/interfaces/interfaces'
import { SavedAccountsMapping } from '../SavedAccountsView'

jest.mock('next/image', () => ({
    __esModule: true,
    // eslint-disable-next-line @next/next/no-img-element
    default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const account = (countryCode: string, type: AccountType): Account =>
    ({
        id: `acc-${countryCode}`,
        type,
        identifier: '012180015000000000',
        details: { countryCode, countryName: '' },
    }) as unknown as Account

const flagSources = (accounts: Account[]) => {
    const { container } = render(<SavedAccountsMapping accounts={accounts} onItemClick={() => {}} />, {
        wrapper: IntlWrapper,
    })
    return [...container.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '')
}

describe('SavedAccountsMapping — the flag', () => {
    it('asks for the two-letter flag of a country the alpha-3 table does not cover', () => {
        const [src] = flagSources([account('MEX', AccountType.CLABE)])
        expect(src).toContain('/mx.')
        expect(src).not.toContain('mex')
    })

    it('still maps the countries the table covers', () => {
        const [src] = flagSources([account('DEU', AccountType.IBAN)])
        expect(src).toContain('/de.')
    })

    it('shows no flag, never a broken one, for a code nothing can map', () => {
        expect(flagSources([account('ZZZ', AccountType.IBAN)])).toEqual([])
    })
})
