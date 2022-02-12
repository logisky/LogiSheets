export type ContextMenuType = 'text' | 'divider'

export class ContextMenuItem {
    public type: ContextMenuType = 'text'
    public text = ''
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public click: () => void = () => {}
}