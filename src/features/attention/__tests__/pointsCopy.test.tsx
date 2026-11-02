import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
jest.mock('@/utils/native-platform', () => ({ useNativePlatform: () => ({ isIOSNative: true }) }))
function Copy() {
    const t = useAppTranslations('home.carousel')
    return <p>{t('rewards.description')}</p>
}
test('iOS rewards CTA names the Points page', () => {
    renderWithIntl(<Copy />)
    expect(screen.getByText(/Open/).textContent).toContain('Points')
})
