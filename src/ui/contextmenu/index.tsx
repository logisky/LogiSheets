import { CSSProperties, MouseEvent } from 'react'
import { DialogComponent, DialogProps } from 'ui/dialog'
import './contextmenu.scss'
export interface ContextMenuProps extends DialogProps {
    items: readonly ContextMenuItem[]
    /**
     * 若需要根据鼠标事件确定contextmenu的位置，则需要传这个域
     */
    mouseevent?: MouseEvent
}

export const ContextMenuComponent = (props: ContextMenuProps) => {
    const { items, mouseevent, close$ } = props
    const contentStyle: CSSProperties = {
        ...props.style?.content,
        left: mouseevent?.clientX,
        top: mouseevent?.clientY,
    }
    const onClick = (item: ContextMenuItem) => {
        item.click()
        close$()
    }
    const content = (
        <div>
            {items.map((item, key) => {
                switch (item.type) {
                    case 'text':
                        return <div className="text" key={key} onClick={() => onClick(item)}>{item.text}</div>
                    case 'divider':
                        return <div className="divider" key={key}></div>
                    default:
                        return <div key={key}></div>
                }
            })}
        </div>
    )
    return <DialogComponent
        content={content}
        {...props}
        style={{ content: contentStyle }}
    >
    </DialogComponent>
}
export type ContextMenuType = 'text' | 'divider'
export class ContextMenuItem {
    public type: ContextMenuType = 'text'
    public text = ''
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public click: () => void = () => { }
}
