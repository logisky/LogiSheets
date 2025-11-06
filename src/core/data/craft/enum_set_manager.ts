/**
 * Represents a single variant in an enum
 */
export interface EnumVariant {
    /** Unique identifier for this variant */
    id: string
    /** The string value of this variant (must be unique within the enum) */
    value: string
    /** Color associated with this variant (hex color code) */
    color: string
}

/**
 * Represents a complete enum definition
 */
export interface EnumInfo {
    /** Unique identifier for this enum */
    id: string
    /** Name of the enum */
    name: string
    /** Description of the enum */
    description?: string
    /** List of variants in this enum */
    variants: EnumVariant[]
}

/**
 * Manager for all enum sets in the application
 * Ensures uniqueness of variant values within each enum
 */
export class EnumSetManager {
    public constructor() {
        this.enums.set('_logisheets_builtin01', {
            id: '_logisheets_builtin01',
            name: 'Gender',
            description: '',
            variants: [
                {id: 'male', value: 'Male', color: '#22c55e'},
                {id: 'female', value: 'Female', color: '#f59e0b'},
            ],
        })
    }

    private enums: Map<string, EnumInfo> = new Map()

    /**
     * Get an enum by its ID
     * @param id The unique identifier of the enum
     * @returns The EnumInfo if found, undefined otherwise
     */
    get(id: string): EnumInfo | undefined {
        return this.enums.get(id)
    }

    /**
     * Get all registered enums
     * @returns Array of all EnumInfo objects
     */
    getAll(): EnumInfo[] {
        return Array.from(this.enums.values())
    }

    /**
     * Check if an enum exists
     * @param id The unique identifier of the enum
     * @returns true if the enum exists, false otherwise
     */
    has(id: string): boolean {
        return this.enums.has(id)
    }

    /**
     * Register a new enum or update an existing one
     * @param id The unique identifier for this enum
     * @param name The name of the enum
     * @param variants The list of variants
     * @param description Optional description
     * @throws Error if variant values are not unique within the enum
     * @returns The created/updated EnumInfo
     */
    set(
        id: string,
        name: string,
        variants: EnumVariant[],
        description?: string
    ): EnumInfo {
        // Validate that all variant values are unique
        this.validateVariantUniqueness(variants)

        const enumInfo: EnumInfo = {
            id,
            name,
            description,
            variants: [...variants], // Create a copy to avoid external mutations
        }

        this.enums.set(id, enumInfo)
        return enumInfo
    }

    /**
     * Update an existing enum
     * @param id The unique identifier of the enum
     */
    update(id: string, info: EnumInfo): EnumInfo {
        if (!this.enums.has(id)) {
            throw new Error(`Enum with id '${id}' does not exist`)
        }
        this.enums.set(id, info)
        return info
    }

    /**
     * Add a variant to an existing enum
     * @param enumId The ID of the enum
     * @param variant The variant to add
     * @throws Error if enum doesn't exist or variant value already exists
     * @returns The updated EnumInfo
     */
    addVariant(enumId: string, variant: EnumVariant): EnumInfo {
        const enumInfo = this.enums.get(enumId)
        if (!enumInfo) {
            throw new Error(`Enum with id '${enumId}' does not exist`)
        }

        // Check if variant value already exists
        if (
            enumInfo.variants.some(
                (v) => v.value === variant.value || v.id === variant.id
            )
        ) {
            throw new Error(
                `Variant with value '${variant.value}' or id '${variant.id}' already exists in enum '${enumId}'`
            )
        }

        const updatedVariants = [...enumInfo.variants, variant]
        const updatedInfo: EnumInfo = {
            ...enumInfo,
            variants: updatedVariants,
        }
        return this.update(enumId, updatedInfo)
    }

    /**
     * Remove a variant from an enum
     * @param enumId The ID of the enum
     * @param variantId The ID of the variant to remove
     * @throws Error if enum doesn't exist
     * @returns The updated EnumInfo
     */
    removeVariant(enumId: string, variantId: string): EnumInfo {
        const enumInfo = this.enums.get(enumId)
        if (!enumInfo) {
            throw new Error(`Enum with id '${enumId}' does not exist`)
        }

        const updatedVariants = enumInfo.variants.filter(
            (v) => v.id !== variantId
        )
        const updatedInfo: EnumInfo = {
            ...enumInfo,
            variants: updatedVariants,
        }
        return this.update(enumId, updatedInfo)
    }

    /**
     * Delete an enum
     * @param id The unique identifier of the enum to delete
     * @returns true if the enum was deleted, false if it didn't exist
     */
    delete(id: string): boolean {
        return this.enums.delete(id)
    }

    /**
     * Clear all enums
     */
    clear(): void {
        this.enums.clear()
    }

    /**
     * Get the number of registered enums
     * @returns The count of enums
     */
    count(): number {
        return this.enums.size
    }

    /**
     * Find enums by name (case-insensitive partial match)
     * @param query The search query
     * @returns Array of matching EnumInfo objects
     */
    search(query: string): EnumInfo[] {
        const lowerQuery = query.toLowerCase()
        return Array.from(this.enums.values()).filter((enumInfo) =>
            enumInfo.name.toLowerCase().includes(lowerQuery)
        )
    }

    /**
     * Validate that all variant values are unique within the list
     * @param variants The list of variants to validate
     * @throws Error if duplicate values are found
     */
    private validateVariantUniqueness(variants: EnumVariant[]): void {
        const values = new Set<string>()
        const ids = new Set<string>()

        for (const variant of variants) {
            if (values.has(variant.value)) {
                throw new Error(
                    `Duplicate variant value '${variant.value}' found. All variant values must be unique within an enum.`
                )
            }
            if (ids.has(variant.id)) {
                throw new Error(
                    `Duplicate variant id '${variant.id}' found. All variant ids must be unique within an enum.`
                )
            }
            values.add(variant.value)
            ids.add(variant.id)
        }
    }

    /**
     * Export all enums as JSON
     * @returns JSON string representation of all enums
     */
    toJSON(): string {
        return JSON.stringify(Array.from(this.enums.entries()))
    }

    /**
     * Import enums from JSON
     * @param json JSON string representation of enums
     * @throws Error if JSON is invalid
     */
    fromJSON(json: string): void {
        try {
            const entries = JSON.parse(json) as [string, EnumInfo][]
            this.enums = new Map(entries)
        } catch (error) {
            throw new Error(`Failed to import enums from JSON: ${error}`)
        }
    }
}
