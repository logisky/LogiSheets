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
    private fieldIdCounter: number = 0
    private usedFieldIds: Set<string> = new Set()

    /**
     * Generate a composite key for field storage
     */
    private getKey(sheetId: number, blockId: number, fieldId: string): string {
        return `${sheetId}:${blockId}:${fieldId}`
    }

    /**
     * Parse a composite key back into components
     */
    private parseKey(key: string): FieldKey {
        const [sheetId, blockId, fieldId] = key.split(':')
        return {
            sheetId: parseInt(sheetId, 10),
            blockId: parseInt(blockId, 10),
            fieldId,
        }
    }

    /**
     * Generate a unique field ID
     * @returns A unique field ID that will never be reused
     */
    private generateFieldId(): string {
        let id: string
        do {
            id = `field_${++this.fieldIdCounter}_${Date.now()}`
        } while (this.usedFieldIds.has(id))
        this.usedFieldIds.add(id)
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

        const key = this.getKey(sheetId, blockId, fieldId)
        this.fields.set(key, fieldInfo)

        return fieldInfo
    }

    /**
     * Get a field by its composite key
     * @param sheetId The sheet ID
     * @param blockId The block ID
     * @param fieldId The field ID
     * @returns The FieldInfo if found, undefined otherwise
     */
    get(
        sheetId: number,
        blockId: number,
        fieldId: string
    ): FieldInfo | undefined {
        const key = this.getKey(sheetId, blockId, fieldId)
        return this.fields.get(key)
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
     * @param sheetId The sheet ID
     * @param blockId The block ID
     * @param fieldId The field ID
     * @returns true if the field exists, false otherwise
     */
    has(sheetId: number, blockId: number, fieldId: string): boolean {
        const key = this.getKey(sheetId, blockId, fieldId)
        return this.fields.has(key)
    }

    /**
     * Update a field (ID cannot be changed)
     * @param sheetId The sheet ID
     * @param blockId The block ID
     * @param fieldId The field ID
     * @param updates Partial field updates
     * @returns The updated FieldInfo, or undefined if field not found
     * @throws Error if attempting to change the field ID
     */
    update(
        sheetId: number,
        blockId: number,
        fieldId: string,
        updates: Partial<
            Omit<FieldInfo, 'id' | 'sheetId' | 'blockId' | 'createdAt'>
        >
    ): FieldInfo | undefined {
        const key = this.getKey(sheetId, blockId, fieldId)
        const field = this.fields.get(key)

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

        this.fields.set(key, updatedField)
        return updatedField
    }

    /**
     * Delete a field
     * @param sheetId The sheet ID
     * @param blockId The block ID
     * @param fieldId The field ID
     * @returns true if the field was deleted, false if it didn't exist
     * @note The field ID will never be reused even after deletion
     */
    delete(sheetId: number, blockId: number, fieldId: string): boolean {
        const key = this.getKey(sheetId, blockId, fieldId)
        // Note: fieldId remains in usedFieldIds to prevent reuse
        return this.fields.delete(key)
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
            this.delete(sheetId, blockId, field.id)
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
            this.delete(field.sheetId, field.blockId, field.id)
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
     * Export all fields as JSON
     * @returns JSON string representation of all fields
     */
    toJSON(): string {
        return JSON.stringify({
            fields: Array.from(this.fields.entries()),
            fieldIdCounter: this.fieldIdCounter,
            usedFieldIds: Array.from(this.usedFieldIds),
        })
    }

    /**
     * Import fields from JSON
     * @param json JSON string representation of fields
     * @throws Error if JSON is invalid
     */
    fromJSON(json: string): void {
        try {
            const data = JSON.parse(json)
            this.fields = new Map(data.fields)
            this.fieldIdCounter = data.fieldIdCounter || 0
            this.usedFieldIds = new Set(data.usedFieldIds || [])
        } catch (error) {
            throw new Error(`Failed to import fields from JSON: ${error}`)
        }
    }
}
