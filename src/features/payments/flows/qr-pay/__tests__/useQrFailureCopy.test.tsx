/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { useQrFailureCopy } from '../useQrFailureCopy'
import { QR_INIT_CODE } from '../init-error-classifier'

describe('useQrFailureCopy', () => {
    // Hugo's round 2: a residence refusal said all of Brazil was down, next to a working withdraw row
    it('words a Pix residence refusal as Pix payments only, never deposits and withdrawals', () => {
        const { result } = renderHook(() => useQrFailureCopy('PIX', 'Pix'), { wrapper: IntlWrapper })
        expect(result.current.scanFailureCopy[QR_INIT_CODE.PIX_RESIDENCE]).toBe(en.pix.payResidence)
        expect(result.current.scanFailureCopy[QR_INIT_CODE.PIX_RESIDENCE]).not.toBe(en.brazilPause.body)
    })
})
