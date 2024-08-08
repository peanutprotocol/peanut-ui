import * as _consts from '../Cashout.consts'

export const ConfirmCashoutView = ({ onNext, onPrev }: _consts.ICashoutScreenProps) => {
    return (
        <div className="flex flex-col items-center justify-center gap-2">
            <button onClick={onPrev}>prev</button>
            <button onClick={onNext}>next</button>
        </div>
    )
}
