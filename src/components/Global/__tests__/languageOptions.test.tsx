import { render } from '@testing-library/react'
import { LANGUAGE_OPTIONS } from '../languageOptions'
import { LOCALE_META } from '@/i18n/localeMeta'
import { MARKETING_SEGMENT } from '@/i18n/app/config'

jest.mock('next/image', () => ({ __esModule: true, default: ({ src }: { src: string }) => <img src={src} alt="" /> }))

const flagOf = (leading: React.ReactNode) =>
    render(<>{leading}</>)
        .container.querySelector('img')
        ?.getAttribute('src')

// TASK-23929 item 6: the app language list flew Spain for es-419 while the
// Help Center switcher flew Mexico; both now read one map
describe('language flags', () => {
    it.each(LANGUAGE_OPTIONS.map((option) => [option.value, option.leading] as const))(
        '%s flies the same flag as the Help Center switcher',
        (locale, leading) => {
            expect(flagOf(leading)).toBe(LOCALE_META[MARKETING_SEGMENT[locale]].flag)
        }
    )

    // TASK-25341: Kush chose Spain over Mexico for Español
    it('es-419 flies Spain', () => {
        expect(LOCALE_META[MARKETING_SEGMENT['es-419']].flag).toBe('/flags/es.svg')
    })
})
