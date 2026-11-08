export type ContextMenuType = 'text' | 'divider'

export class ContextMenuItem {
    public type: ContextMenuType = 'text'
    public text = ''

    public click: () => void = () => {}
}
