/**
 * OtaUpdateModal — dismissal locking per apply state.
 * ActionModal is stubbed to surface the lock props as data-attributes, because
 * `preventClose` alone leaves the close button live and a mid-apply dismissal
 * hides the failure state the user has to act on.
 */
import React from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import { screen } from '@testing-library/react'
import OtaUpdateModal from '@/components/Profile/components/OtaUpdateModal'
import type { OtaApplyState } from '@/context/OtaUpdateContext'

const mockOta = {
    pendingBundle: { id: 'b-2', version: '1.2.3' } as { id: string; version: string } | null,
    applyState: 'idle' as OtaApplyState,
    applyNow: jest.fn(),
}

jest.mock('@/context/OtaUpdateContext', () => ({ useOtaUpdate: () => mockOta }))

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ visible, description, ctas, preventClose, hideModalCloseButton }: any) =>
        visible ? (
            <div
                data-testid="modal"
                data-prevent-close={String(!!preventClose)}
                data-hide-close={String(!!hideModalCloseButton)}
            >
                <p>{description}</p>
                {ctas?.map((c: any, i: number) => (
                    <button key={i} disabled={c.disabled}>
                        {c.text}
                    </button>
                ))}
            </div>
        ) : null,
}))

const renderAt = (applyState: OtaApplyState) => {
    mockOta.applyState = applyState
    return renderWithIntl(<OtaUpdateModal visible onClose={jest.fn()} />)
}

beforeEach(() => {
    mockOta.applyState = 'idle'
    mockOta.pendingBundle = { id: 'b-2', version: '1.2.3' }
})

describe('OtaUpdateModal dismissal locking', () => {
    it('locks every dismissal path while the apply is in flight', () => {
        renderAt('applying')
        const modal = screen.getByTestId('modal')
        expect(modal.dataset.preventClose).toBe('true')
        expect(modal.dataset.hideClose).toBe('true')
    })

    it.each<OtaApplyState>(['idle', 'failed', 'manual-restart'])('leaves the modal dismissable when %s', (state) => {
        renderAt(state)
        const modal = screen.getByTestId('modal')
        expect(modal.dataset.preventClose).toBe('false')
        expect(modal.dataset.hideClose).toBe('false')
    })

    it('offers a retry once the apply failed, so the lock never strands the user', () => {
        renderAt('failed')
        expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
    })
})
