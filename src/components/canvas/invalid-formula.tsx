import {MouseEvent} from 'react'

export interface InvalidFormulaProps {
    close$: () => void
}
export const InvalidFormulaComponent = ({close$}: InvalidFormulaProps) => {
    const close = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        close$()
    }
    return (
        <div>
            <div>您输入的公式存在错误。</div>
            <div>如果您输入的内容不是公式，请在第一个字符之前输入单引号。</div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                }}
            >
                <button onMouseDown={close}>确认</button>
            </div>
        </div>
    )
}
