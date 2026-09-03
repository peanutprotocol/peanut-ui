import { act, render } from '@testing-library/react'
import Modal from '..'
import { dispatchBackPress, resetBackHandlersForTests } from '@/utils/back-handler'

jest.mock('@/components/Global/Icons/Icon', () => ({
    Icon: () => null,
}))

describe('Modal hardware back', () => {
    beforeEach(() => {
        resetBackHandlersForTests()
    })

    it('closes a visible modal and consumes the press', () => {
        const onClose = jest.fn()
        render(
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
        render(
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
        render(
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
            <Modal visible onClose={onClose}>
                <div>body</div>
            </Modal>
        )
        view.rerender(
            <Modal visible={false} onClose={onClose}>
                <div>body</div>
            </Modal>
        )

        expect(dispatchBackPress()).toBe(false)
        expect(onClose).not.toHaveBeenCalled()
    })
})
