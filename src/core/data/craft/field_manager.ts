/**
 * Represents a field's type and configuration
 */
export type FieldTypeEnum =
    | {type: 'enum'; id: string}
    | {type: 'multiSelect'; id: string}
    | {type: 'datetime'; formatter: string}
    | {type: 'boolean'}
    | {type: 'string'; validation: string}
    | {type: 'number'; validation: string; formatter: string}
    | {type: 'image'}

/**
 * Represents a complete field definition
 */
export interface FieldInfo {
    /** Unique identifier for this field (cannot be changed or reused) */
    id: string
    /** Sheet ID this field belongs to */
    sheetId: number
    /** Block ID this field belongs to */
    blockId: number
    /** Name of the field */
    name: string
    /** Type of the field */
    type: FieldTypeEnum
    /** Optional description */
    description?: string
    /** Whether this field is required */
    required: boolean
    /** Default value */
    defaultValue?: string
}

/**
 * Composite key for field lookup
 */
interface FieldKey {
    sheetId: number
    blockId: number
    fieldId: string
}

/**
 * Manager for all fields in the application
 * Ensures field IDs are unique and immutable
 */
export class FieldManager {
    private fields: Map<string, FieldInfo> = new Map()
    private _counter = 0

    /**
     * Generate a unique field ID
     * @returns A unique field ID that will never be reused
     */
    private generateFieldId(): string {
        const id = `field_${Date.now()}_${++this._counter}`
        return id
    }

    /**
     * Create a new field
     * @param sheetId The sheet ID
     * @param blockId The block ID
     * @param fieldData Field configuration (without id)
     * @returns The created FieldInfo with generated ID
     */
    create(
        sheetId: number,
        blockId: number,
        fieldData: Omit<FieldInfo, 'id' | 'sheetId' | 'blockId'>
    ): FieldInfo {
        const fieldId = this.generateFieldId()

        const fieldInfo: FieldInfo = {
            ...fieldData,
            id: fieldId,
            sheetId,
            blockId,
        }

        this.fields.set(fieldId, fieldInfo)

        return fieldInfo
    }

    /**
     * Get a field by its composite key
     * @param fieldId The field ID
     * @returns The FieldInfo if found, undefined otherwise
     */
    get(fieldId: string): FieldInfo | undefined {
        return this.fields.get(fieldId)
    }

    /**
     * Get all fields for a specific sheet and block
     * @param sheetId The sheet ID
     * @param blockId The block ID
     * @returns Array of all FieldInfo objects for the block
     */
    getByBlock(sheetId: number, blockId: number): FieldInfo[] {
        const prefix = `${sheetId}:${blockId}:`
        return Array.from(this.fields.entries())
            .filter(([key]) => key.startsWith(prefix))
            .map(([, field]) => field)
    }

    /**
     * Get all fields for a specific sheet
     * @param sheetId The sheet ID
     * @returns Array of all FieldInfo objects for the sheet
     */
    getBySheet(sheetId: number): FieldInfo[] {
        const prefix = `${sheetId}:`
        return Array.from(this.fields.entries())
            .filter(([key]) => key.startsWith(prefix))
            .map(([, field]) => field)
    }

    /**
     * Get all fields
     * @returns Array of all FieldInfo objects
     */
    getAll(): FieldInfo[] {
        return Array.from(this.fields.values())
    }

    /**
     * Check if a field exists
     * @param fieldId The field ID
     * @returns true if the field exists, false otherwise
     */
    has(fieldId: string): boolean {
        return this.fields.has(fieldId)
    }

    /**
     * Update a field (ID cannot be changed)
     * @param fieldId The field ID
     * @param updates Partial field updates
     * @returns The updated FieldInfo, or undefined if field not found
     * @throws Error if attempting to change the field ID
     */
    update(
        fieldId: string,
        updates: Partial<
            Omit<FieldInfo, 'id' | 'sheetId' | 'blockId' | 'createdAt'>
        >
    ): FieldInfo | undefined {
        const field = this.fields.get(fieldId)

        if (!field) {
            return undefined
        }

        const updatedField: FieldInfo = {
            ...field,
            ...updates,
            // Ensure these cannot be changed
            id: field.id,
            sheetId: field.sheetId,
            blockId: field.blockId,
        }

        this.fields.set(fieldId, updatedField)
        return updatedField
    }

    /**
     * Delete a field
     * @param fieldId The field ID
     * @returns true if the field was deleted, false if it didn't exist
     * @note The field ID will never be reused even after deletion
     */
    delete(fieldId: string): boolean {
        return this.fields.delete(fieldId)
    }

    /**
     * Delete all fields for a specific block
     * @param sheetId The sheet ID
     * @param blockId The block ID
     * @returns Number of fields deleted
     */
    deleteBlock(sheetId: number, blockId: number): number {
        const fieldsToDelete = this.getByBlock(sheetId, blockId)
        fieldsToDelete.forEach((field) => {
            this.delete(field.id)
        })
        return fieldsToDelete.length
    }

    /**
     * Delete all fields for a specific sheet
     * @param sheetId The sheet ID
     * @returns Number of fields deleted
     */
    deleteSheet(sheetId: number): number {
        const fieldsToDelete = this.getBySheet(sheetId)
        fieldsToDelete.forEach((field) => {
            this.delete(field.id)
        })
        return fieldsToDelete.length
    }

    /**
     * Clear all fields
     * @note Field IDs remain reserved to prevent reuse
     */
    clear(): void {
        this.fields.clear()
        // usedFieldIds is NOT cleared to prevent ID reuse
    }

    /**
     * Get the total number of fields
     * @returns The count of fields
     */
    count(): number {
        return this.fields.size
    }

    /**
     * Search fields by name (case-insensitive partial match)
     * @param query The search query
     * @returns Array of matching FieldInfo objects
     */
    search(query: string): FieldInfo[] {
        const lowerQuery = query.toLowerCase()
        return Array.from(this.fields.values()).filter((field) =>
            field.name.toLowerCase().includes(lowerQuery)
        )
    }

    /**
     * Import fields from JSON
     * @param json JSON string representation of fields
     * @throws Error if JSON is invalid
     */
    fromJSON(json: string): void {
        try {
            const data = JSON.parse(json) as FieldInfo[]
            this.fields = new Map(data.map((f) => [f.id, f]))
        } catch (error) {
            throw new Error(`Failed to import fields from JSON: ${error}`)
        }
    }
}
