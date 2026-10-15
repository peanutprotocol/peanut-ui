import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { AnimateOnView } from '../AnimateOnView'

const globalsCss = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8')

describe('AnimateOnView', () => {
    it('wires children to the animate-on-view entrance', () => {
        const { container, getByText } = render(
            <AnimateOnView>
                <p>hello</p>
            </AnimateOnView>
        )

        expect(getByText('hello')).toBeInTheDocument()
        expect(container.querySelector('.animate-on-view')).toBeInTheDocument()
        expect(globalsCss).toMatch(/\.animate-on-view\.in-view\s*{[^}]*animation:\s*fade-in-up-spring/s)
    })

    it('respects prefers-reduced-motion: content shows with no rise or fade (K9)', () => {
        // The base class hides content (opacity: 0) until the entrance animation
        // runs, so the guard must both restore opacity and stop the animation.
        expect(globalsCss).toMatch(
            /@media \(prefers-reduced-motion: reduce\)\s*{\s*\.animate-on-view\s*{[^}]*opacity:\s*1[\s\S]*?\.animate-on-view\.in-view\s*{[^}]*animation:\s*none/
        )
    })
})
