/**
 * Represents a field's type and configuration
 */
export type FieldTypeEnum = {
    type: "enum";
    id: string;
} | {
    type: "multiSelect";
    id: string;
} | {
    type: "datetime";
    formatter: string;
} | {
    type: "boolean";
} | {
    type: "string";
    validation: string;
} | {
    type: "number";
    validation: string;
    formatter: string;
} | {
    type: "image";
};
/**
 * Represents a complete field definition
 */
export interface FieldInfo {
    /** Unique identifier for this field (cannot be changed or reused) */
    id: string;
    /** Sheet ID this field belongs to */
    sheetId: number;
    /** Block ID this field belongs to */
    blockId: number;
    /** Name of the field */
    name: string;
    /** Type of the field */
    type: FieldTypeEnum;
    /** Optional description */
    description?: string;
    /** Whether this field is required */
    required: boolean;
    /** Default value */
    defaultValue?: string;
}
/**
 * Manager for all fields in the application
 * Ensures field IDs are unique and immutable
 */
export declare class FieldManager {
    private fields;
    private _counter;
    /**
     * Generate a unique field ID
     * @returns A unique field ID that will never be reused
     */
    private generateFieldId;
    /**
     * Create a new field
     * @param sheetId The sheet ID
     * @param blockId The block ID
     * @param fieldData Field configuration (without id)
     * @returns The created FieldInfo with generated ID
     */
    create(sheetId: number, blockId: number, fieldData: Omit<FieldInfo, "id" | "sheetId" | "blockId">): FieldInfo;
    /**
     * Get a field by its composite key
     * @param fieldId The field ID
     * @returns The FieldInfo if found, undefined otherwise
     */
    get(fieldId: string): FieldInfo | undefined;
    /**
     * Get all fields for a specific sheet and block
     * @param sheetId The sheet ID
     * @param blockId The block ID
     * @returns Array of all FieldInfo objects for the block
     */
    getByBlock(sheetId: number, blockId: number): FieldInfo[];
    /**
     * Get all fields for a specific sheet
     * @param sheetId The sheet ID
     * @returns Array of all FieldInfo objects for the sheet
     */
    getBySheet(sheetId: number): FieldInfo[];
    /**
     * Get all fields
     * @returns Array of all FieldInfo objects
     */
    getAll(): FieldInfo[];
    /**
     * Check if a field exists
     * @param fieldId The field ID
     * @returns true if the field exists, false otherwise
     */
    has(fieldId: string): boolean;
    /**
     * Update a field (ID cannot be changed)
     * @param fieldId The field ID
     * @param updates Partial field updates
     * @returns The updated FieldInfo, or undefined if field not found
     * @throws Error if attempting to change the field ID
     */
    update(fieldId: string, updates: Partial<Omit<FieldInfo, "id" | "sheetId" | "blockId">>): FieldInfo | undefined;
    /**
     * Delete a field
     * @param fieldId The field ID
     * @returns true if the field was deleted, false if it didn't exist
     * @note The field ID will never be reused even after deletion
     */
    delete(fieldId: string): boolean;
    /**
     * Delete all fields for a specific block
     * @param sheetId The sheet ID
     * @param blockId The block ID
     * @returns Number of fields deleted
     */
    deleteBlock(sheetId: number, blockId: number): number;
    /**
     * Delete all fields for a specific sheet
     * @param sheetId The sheet ID
     * @returns Number of fields deleted
     */
    deleteSheet(sheetId: number): number;
    /**
     * Clear all fields
     * @note Field IDs remain reserved to prevent reuse
     */
    clear(): void;
    /**
     * Get the total number of fields
     * @returns The count of fields
     */
    count(): number;
    /**
     * Search fields by name (case-insensitive partial match)
     * @param query The search query
     * @returns Array of matching FieldInfo objects
     */
    search(query: string): FieldInfo[];
    /**
     * Import fields from JSON
     * @param json JSON string representation of fields
     * @throws Error if JSON is invalid
     */
    fromJSON(json: string): void;
}
