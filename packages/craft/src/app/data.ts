export interface DataValue {
    fieldId: string
    key: string
    /**
     * Can be a formula or a static value.
     * If it's a formula, it should start with '='.
     *
     * The type of this value is referred by the calculation result of the field.
     */
    value?: string
}

export interface DataField {
    validation: string
    id: string
}

export class DataFieldBuilder {
    private field: DataField = {
        validation: '',
        id: '',
    }

    validation(validation: string): DataFieldBuilder {
        this.field.validation = validation
        return this
    }

    id(id: string): DataFieldBuilder {
        this.field.id = id
        return this
    }

    build(): DataField {
        if (!this.field.id) {
            throw new Error('id is required')
        }
        return this.field
    }
}

export class DataBlock {
    fields: DataField[] = []
    values: DataValue[] = []

    /**
     * Coordinate of the top left cell of the block.
     */
    fromRow: number = 0
    fromCol: number = 0
    toRow: number = 0
    toCol: number = 0
}
