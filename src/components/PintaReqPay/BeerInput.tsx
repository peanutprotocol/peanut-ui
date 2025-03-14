import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { twMerge } from 'tailwind-merge'
import { Button } from '../0_Bruddle'
import Icon from '../Global/Icon'

type BeerInputProps = {
    min?: number
    max?: number
}

const BeerInput: React.FC<BeerInputProps> = ({ min = 1, max = 99 }) => {
    const { beerQuantity } = usePaymentStore()
    const dispatch = useAppDispatch()

    const increment = () => {
        if (beerQuantity < max) dispatch(paymentActions.setBeerQuantity(beerQuantity + 1))
    }

    const decrement = () => {
        if (beerQuantity > min) dispatch(paymentActions.setBeerQuantity(beerQuantity - 1))
    }

    return (
        <div className="relative flex w-full items-center justify-center border border-black p-3">
            <div className={twMerge('mx-auto flex items-center gap-2', beerQuantity === 0 && 'text-gray-1')}>
                <span className="text-h1">{beerQuantity}</span>
                <span className="text-h5 font-bold">{beerQuantity > 1 ? 'Beers' : 'Beer'}</span>
            </div>
            <div className="absolute right-4 flex flex-col ">
                <Button
                    size="medium"
                    variant="transparent-dark"
                    onClick={increment}
                    className="w-12 p-0 hover:bg-gray-50"
                    aria-label="Increase beer count"
                >
                    <Icon name="arrow-bottom" className="h-10 w-10 rotate-180" />
                </Button>
                <Button
                    size="medium"
                    variant="transparent-dark"
                    onClick={decrement}
                    className="w-12 p-0 hover:bg-gray-50"
                    aria-label="Decrease beer count"
                >
                    <Icon name="arrow-bottom" className="h-5 w-5" />
                </Button>
            </div>
        </div>
    )
}

export default BeerInput
