export interface Craft {
    id: string
    name: string
    description: string

    loadRole(role?: Role): void
    editor(): HTMLElement
}

export interface Role {
    id: string
    init(userId: string): void
}
