import { render } from '@testing-library/react'
import { KnerdJoinTitle } from '@/components/Marketing/StarLp/KnerdJoinTitle'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'

const fitEm = (el: Element) => Number((el as HTMLElement).style.getPropertyValue('--fit-em'))
const fitLines = (el: Element) => Number((el as HTMLElement).style.getPropertyValue('--fit-lines'))

describe('masthead Knerd', () => {
    it('KnerdTitle oneLineFrom renders the stacked lines and the one-row copy, each fitted to its own width', () => {
        const { container } = render(<KnerdTitle text={'Send\nthis.'} size="masthead" oneLineFrom="lg" />)
        const [stacked, row] = [...container.querySelectorAll('.star-lp-fit-knerd')]
        expect(stacked.className.split(' ')).toEqual(expect.arrayContaining(['block', 'lg:hidden']))
        expect(row.className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'lg:block']))
        expect(fitLines(stacked)).toBe(2)
        expect(fitLines(row)).toBe(1)
        // one row is wider in em than its widest stacked line, so it fits smaller per em
        expect(fitEm(row)).toBeGreaterThan(fitEm(stacked))
    })

    it('KnerdTitle without oneLineFrom renders one fitted copy', () => {
        const { container } = render(<KnerdTitle text={'No\nproblem'} size="masthead" />)
        expect(container.querySelectorAll('.star-lp-fit-knerd')).toHaveLength(1)
    })

    it('KnerdJoinTitle stacks on tall phones at one size fitted to the wider row', () => {
        const { container } = render(<KnerdJoinTitle left="US" join="and" right="Europe" />)
        const row = container.querySelector('.star-lp-knerd-row-md')!
        const stack = container.querySelector('.star-lp-knerd-stack-md')!
        expect(fitLines(row)).toBe(1)
        expect(fitLines(stack)).toBe(2)
        expect(fitEm(stack)).toBeLessThan(fitEm(row))
    })
})
