/** @jest-environment jsdom */
// One verify intro in the whole app (TASK-25063): outside sign-up, Verify start lists only the steps left, Verify now
// goes on and Remind me later goes back, and the shell's footer never draws over a full-screen overlay.
import { fireEvent, render, screen, within } from '@testing-library/react'
import { IntlProvider, msg } from '@/components/Setup/redesign/Landing/__tests__/redesign-harness'
import { VerifyStartIntro } from '../VerifyStartIntro'

jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
let mockRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({ useResidenceRestrictions: () => mockRestrictions }))
beforeEach(() => {
    mockRestrictions = { banking: false, card: false }
})

function renderIntro(questions: boolean) {
    const onVerify = jest.fn()
    const onLater = jest.fn()
    render(
        <IntlProvider>
            <VerifyStartIntro
                controlScreen="steps-overview"
                questions={questions}
                onVerify={onVerify}
                onLater={onLater}
            />
        </IntlProvider>
    )
    return { onVerify, onLater }
}

const rows = () => within(screen.getByTestId('setup-redesign-verify-steps')).getAllByRole('listitem')

describe('VerifyStartIntro', () => {
    it('lists the questions, then the ID photo, while the questions are still to answer', () => {
        renderIntro(true)
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(msg('setupRedesign.verifyStart.title'))
        expect(rows().map((row) => row.textContent)).toEqual([
            `1${msg('setupRedesign.verifyStart.stepQuestions')}`,
            `2${msg('setupRedesign.verifyStart.stepPhoto')}`,
        ])
        expect(rows()[0]).toHaveAttribute('aria-current', 'step')
        expect(screen.getByTestId('setup-redesign-verify-now')).toHaveTextContent(
            msg('setupRedesign.verifyStart.verifyNow')
        )
        expect(screen.getByText(msg('setupRedesign.verifyStart.sub'))).toBeInTheDocument()
    })

    it('lists only the ID photo once the questions are answered: no residence, review or unlock row', () => {
        renderIntro(false)
        expect(rows().map((row) => row.textContent)).toEqual([`1${msg('setupRedesign.verifyStart.stepPhoto')}`])
        expect(rows()[0]).toHaveAttribute('aria-current', 'step')
        // two minutes, not three, with the questions done
        expect(screen.getByTestId('setup-redesign-verify-now')).toHaveTextContent(
            msg('setupRedesign.verifyStart.verifyNowIdOnly')
        )
    })

    it('promises the card, not bank details, where bank rails are closed and the card is open', () => {
        mockRestrictions = { banking: true, card: false }
        renderIntro(true)
        expect(screen.getByText(msg('setupRedesign.verifyStart.subCard'))).toBeInTheDocument()
        expect(screen.queryByText(msg('setupRedesign.verifyStart.sub'))).toBeNull()
    })

    it('goes on with Verify now and back with Remind me later', () => {
        const { onVerify, onLater } = renderIntro(true)
        fireEvent.click(screen.getByRole('button', { name: msg('setupRedesign.verifyStart.remindLater') }))
        expect(onLater).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByTestId('setup-redesign-verify-now'))
        expect(onVerify).toHaveBeenCalledTimes(1)
    })

    it('keeps the shell footer inside the shell: its z-40 cannot draw over an overlay such as the ID-check intro', () => {
        renderIntro(true)
        const shell = document.querySelector('[data-setup-shell]')!
        expect(shell).toHaveClass('isolate')
        expect(shell.querySelector('[data-setup-footer]')).not.toBeNull()
    })
})
