import type { SelectedData } from "logisheets-web";
/**
 * Context menu item definition
 */
export interface ContextMenuItem {
    /** Unique identifier for the menu item */
    id: string;
    /** Display label */
    label: string;
    /** Optional icon (emoji or text) */
    icon?: string;
    /** Whether the item is disabled */
    disabled?: boolean;
    /** Whether to show a separator after this item */
    separator?: boolean;
    /** Keyboard shortcut hint (display only) */
    shortcut?: string;
    /** Sub-menu items (if any) */
    children?: ContextMenuItem[];
}
/**
 * The target type where context menu was triggered
 */
export type ContextMenuTarget = "cell" | "row" | "column";
/**
 * Context passed to menu item click handlers
 */
export interface ContextMenuContext {
    /** The selected data when menu was triggered */
    selectedData: SelectedData;
    /** What was clicked - cell, row header, or column header */
    target: ContextMenuTarget;
    /** Row index if a specific row was clicked */
    row?: number;
    /** Column index if a specific column was clicked */
    col?: number;
    /** The original mouse event */
    event: MouseEvent;
}
