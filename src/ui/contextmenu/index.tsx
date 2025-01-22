import {CSSProperties, MouseEvent} from 'react'
import {DialogComponent, DialogProps} from '@/ui/dialog'
import './contextmenu.scss'
export interface ContextMenuProps extends DialogProps {
    items: readonly ContextMenuItem[]
    mouseevent?: MouseEvent
}

export const ContextMenuComponent = (props: ContextMenuProps) => {
    const {items, mouseevent, close$} = props
    const contentStyle: CSSProperties = {
        ...props.style?.content,
        left: mouseevent?.clientX,
        top: mouseevent?.clientY,
    }
    const onClick = (item: ContextMenuItem) => {
        item.click()
        close$?.()
    }
    return (
        <DialogComponent {...props} style={{content: contentStyle}}>
            <div>
                {items.map((item, key) => {
                    switch (item.type) {
                        case 'text':
                            return (
                                <div
                                    className="text"
                                    key={key}
                                    onClick={() => onClick(item)}
                                >
                                    {item.text}
                                </div>
                            )
                        case 'divider':
                            return <div className="divider" key={key} />
                        default:
                            return <div key={key} />
                    }
                })}
            </div>
        </DialogComponent>
    )
}
export type ContextMenuType = 'text' | 'divider'
export class ContextMenuItem {
    public type: ContextMenuType = 'text'
    public text = ''
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public click: () => Promise<void> = async () => {}
}
