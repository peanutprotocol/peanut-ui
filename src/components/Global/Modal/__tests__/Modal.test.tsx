import { act, render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import Modal from '..'
import { dispatchBackPress, resetBackHandlersForTests } from '@/utils/back-handler'

jest.mock('@/components/Global/Icons/Icon', () => ({
    Icon: () => null,
}))

// the close button reads the localized common.close aria-label
const renderModal = (ui: React.ReactElement) =>
    render(
        <NextIntlClientProvider locale="en" messages={en}>
            {ui}
        </NextIntlClientProvider>
    )

describe('Modal hardware back', () => {
    beforeEach(() => {
        resetBackHandlersForTests()
    })

    it('closes a visible modal and consumes the press', () => {
        const onClose = jest.fn()
        renderModal(
            <Modal visible onClose={onClose}>
                <div>body</div>
            </Modal>
        )

        let consumed = false
        act(() => {
            consumed = dispatchBackPress()
        })
        expect(consumed).toBe(true)
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('consumes the press without closing when preventClose is set', () => {
        const onClose = jest.fn()
        renderModal(
            <Modal visible onClose={onClose} preventClose>
                <div>body</div>
            </Modal>
        )

        let consumed = false
        act(() => {
            consumed = dispatchBackPress()
        })
        expect(consumed).toBe(true)
        expect(onClose).not.toHaveBeenCalled()
    })

    it('does not intercept while hidden', () => {
        const onClose = jest.fn()
        renderModal(
            <Modal visible={false} onClose={onClose}>
                <div>body</div>
            </Modal>
        )

        expect(dispatchBackPress()).toBe(false)
        expect(onClose).not.toHaveBeenCalled()
    })

    it('releases the handler once the modal hides', () => {
        const onClose = jest.fn()
        const view = render(
            <NextIntlClientProvider locale="en" messages={en}>
                <Modal visible onClose={onClose}>
                    <div>body</div>
                </Modal>
            </NextIntlClientProvider>
        )
        view.rerender(
            <NextIntlClientProvider locale="en" messages={en}>
                <Modal visible={false} onClose={onClose}>
                    <div>body</div>
                </Modal>
            </NextIntlClientProvider>
        )

        expect(dispatchBackPress()).toBe(false)
        expect(onClose).not.toHaveBeenCalled()
    })
})
