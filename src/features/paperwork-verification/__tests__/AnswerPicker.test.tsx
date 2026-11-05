import { render, screen } from '@testing-library/react'
import type { CaptureResult } from 'posthog-js'
import type { PaperworkVerificationField } from '@/app/actions/types/kyc-paperwork-verification.types'
import { maskReplayAttribute, maskReplayTextIn } from '@/utils/replay-privacy'
import { redactAutocapture } from '@/utils/posthog-autocapture'
import { SentencePill } from '../components/AnswerPicker'

describe('SentencePill typed-place privacy', () => {
    const city = 'Kleindorf'
    const field: PaperworkVerificationField = {
        key: 'cityOfBirth',
        kind: 'place',
        required: true,
        value: null,
        countryField: 'countryOfBirth',
    }

    it('masks the typed city in replay text, title and accessible name', () => {
        render(<SentencePill field={field} value={city} shown={city} title="City of birth" />)
        const button = screen.getByRole('button')
        const shown = screen.getByTitle(city)
        expect(shown).toHaveTextContent(city)
        expect(button.getAttribute('aria-label')).toContain(city)
        expect(maskReplayTextIn(city, shown)).not.toContain(city)
        expect(maskReplayAttribute('title', city, shown)).not.toContain(city)
        expect(maskReplayAttribute('aria-label', button.getAttribute('aria-label')!, button)).not.toContain(city)
    })

    it('removes the typed city from click autocapture with its real element ancestry', () => {
        render(<SentencePill field={field} value={city} shown={city} title="City of birth" />)
        const button = screen.getByRole('button')
        const chain: Element[] = []
        for (let element: Element | null = button; element; element = element.parentElement) chain.push(element)
        const event = {
            event: '$autocapture',
            properties: {
                $el_text: city,
                $elements: chain.map((element) => ({
                    tag_name: element.tagName.toLowerCase(),
                    classes: Array.from(element.classList),
                    ...(element === button && {
                        $el_text: city,
                        attr__title: city,
                        'attr__aria-label': button.getAttribute('aria-label'),
                    }),
                })),
            },
        } as unknown as CaptureResult
        expect(JSON.stringify(redactAutocapture(event, 'https://peanut.me/verify'))).not.toContain(city)
    })
})
