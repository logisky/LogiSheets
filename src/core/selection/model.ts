export class SelectionModel<T> {
    constructor(
        public readonly multi = false,
        public readonly data: readonly T[] = []
    ) {
        data.forEach((d) => {
            this.#selected.set(d, true)
        })
    }
    get selected(): readonly T[] {
        const selecteds: T[] = []
        this.#selected.forEach((checked, d) => {
            if (!checked) return
            selecteds.push(d)
        })
        return selecteds
    }
    toggle(data: T) {
        if (this.#selected.has(data)) this.#selected.set(data, true)
        else this.#selected.set(data, false)
    }
    select(data: T) {
        this.#selected.set(data, true)
    }
    deSelect(data: T) {
        this.#selected.set(data, false)
    }
    #selected = new Map<T, boolean>()
}
