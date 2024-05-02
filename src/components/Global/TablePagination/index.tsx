'use client'
import Icon from '@/components/Global/Icon'

type TablePaginationProps = {
    onNext: () => void
    onPrev: () => void
    currentPage: number
    totalPages: number
}

const TablePagination = ({ onNext, onPrev, currentPage, totalPages }: TablePaginationProps) => (
    <div className="mt-6 flex w-full items-center justify-between md:mt-5">
        <button className="btn-xs btn-stroke sm:btn-small" onClick={onPrev}>
            <Icon name="arrow-prev" className="sm:!ml-0" />
            <span className="hidden  sm:block">Prev</span>
        </button>
        <div className="text-sm font-bold">
            Page {currentPage} of {totalPages}
        </div>
        <button className="btn-xs btn-stroke sm:btn-small" onClick={onNext}>
            <span className="hidden sm:block">Next</span>
            <Icon name="arrow-next" className="sm:!ml-0" />
        </button>
    </div>
)

export default TablePagination
