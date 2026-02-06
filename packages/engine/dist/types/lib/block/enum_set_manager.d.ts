/**
 * Represents a single variant in an enum
 */
export interface EnumVariant {
    /** Unique identifier for this variant */
    id: string;
    /** The string value of this variant (must be unique within the enum) */
    value: string;
    /** Color associated with this variant (hex color code) */
    color: string;
}
/**
 * Represents a complete enum definition
 */
export interface EnumInfo {
    /** Unique identifier for this enum */
    id: string;
    /** Name of the enum */
    name: string;
    /** Description of the enum */
    description?: string;
    /** List of variants in this enum */
    variants: EnumVariant[];
}
/**
 * Manager for all enum sets in the application
 * Ensures uniqueness of variant values within each enum
 */
export declare class EnumSetManager {
    constructor();
    private enums;
    /**
     * Get an enum by its ID
     * @param id The unique identifier of the enum
     * @returns The EnumInfo if found, undefined otherwise
     */
    get(id: string): EnumInfo | undefined;
    /**
     * Get all registered enums
     * @returns Array of all EnumInfo objects
     */
    getAll(): EnumInfo[];
    /**
     * Check if an enum exists
     * @param id The unique identifier of the enum
     * @returns true if the enum exists, false otherwise
     */
    has(id: string): boolean;
    /**
     * Register a new enum or update an existing one
     * @param id The unique identifier for this enum
     * @param name The name of the enum
     * @param variants The list of variants
     * @param description Optional description
     * @throws Error if variant values are not unique within the enum
     * @returns The created/updated EnumInfo
     */
    set(id: string, name: string, variants: EnumVariant[], description?: string): EnumInfo;
    /**
     * Update an existing enum
     * @param id The unique identifier of the enum
     */
    update(id: string, info: EnumInfo): EnumInfo;
    /**
     * Add a variant to an existing enum
     * @param enumId The ID of the enum
     * @param variant The variant to add
     * @throws Error if enum doesn't exist or variant value already exists
     * @returns The updated EnumInfo
     */
    addVariant(enumId: string, variant: EnumVariant): EnumInfo;
    /**
     * Remove a variant from an enum
     * @param enumId The ID of the enum
     * @param variantId The ID of the variant to remove
     * @throws Error if enum doesn't exist
     * @returns The updated EnumInfo
     */
    removeVariant(enumId: string, variantId: string): EnumInfo;
    /**
     * Delete an enum
     * @param id The unique identifier of the enum to delete
     * @returns true if the enum was deleted, false if it didn't exist
     */
    delete(id: string): boolean;
    /**
     * Clear all enums
     */
    clear(): void;
    /**
     * Get the number of registered enums
     * @returns The count of enums
     */
    count(): number;
    /**
     * Find enums by name (case-insensitive partial match)
     * @param query The search query
     * @returns Array of matching EnumInfo objects
     */
    search(query: string): EnumInfo[];
    /**
     * Validate that all variant values are unique within the list
     * @param variants The list of variants to validate
     * @throws Error if duplicate values are found
     */
    private validateVariantUniqueness;
    /**
     * Export all enums as JSON
     * @returns JSON string representation of all enums
     */
    toJSON(): string;
    /**
     * Import enums from JSON
     * @param json JSON string representation of enums
     * @throws Error if JSON is invalid
     */
    fromJSON(json: string): void;
}
