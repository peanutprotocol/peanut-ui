import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { CloudsCss } from '../CloudsCss'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src: _src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}))

const globalsCss = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8')

describe('CloudsCss', () => {
    it('connects both rendered cloud directions to their drift animations', () => {
        const { container } = render(
            <CloudsCss
                clouds={[
                    { top: '10%', width: 180, speed: '38s', direction: 'ltr' },
                    { top: '20%', width: 200, speed: '40s', direction: 'rtl' },
                ]}
            />
        )

        expect(container.querySelector('.cloud-ltr')).toBeInTheDocument()
        expect(container.querySelector('.cloud-rtl')).toBeInTheDocument()
        expect(globalsCss).toContain('@keyframes cloud-drift-ltr')
        expect(globalsCss).toContain('@keyframes cloud-drift-rtl')
        expect(globalsCss).toMatch(/\.cloud-ltr\s*{[^}]*animation:\s*cloud-drift-ltr/s)
        expect(globalsCss).toMatch(/\.cloud-rtl\s*{[^}]*animation:\s*cloud-drift-rtl/s)
    })

    it('moves right-to-left clouds across the viewport and respects reduced motion', () => {
        expect(globalsCss).toMatch(
            /@keyframes cloud-drift-rtl\s*{[\s\S]*?from\s*{[^}]*translateX\(100vw\)[\s\S]*?to\s*{[^}]*translateX\(-300px\)/
        )
        expect(globalsCss).toMatch(
            /@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*?\.cloud-ltr,\s*\.cloud-rtl,\s*\.cloud-drift\s*{[^}]*animation:\s*none/
        )
    })
})
