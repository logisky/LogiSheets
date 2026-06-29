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
  /**
   * Which trigger targets this item applies to. When omitted the item shows
   * for every target; otherwise it only shows when the menu was opened on one
   * of the listed targets (e.g. `["row", "column"]` for an insert/delete
   * action, `["cell"]` for "Clear Cells").
   */
  targets?: ContextMenuTarget[];
  /**
   * Item kind. `"action"` (default) is a plain clickable row. `"stepper"`
   * renders an inline numeric control (− value +) the user adjusts in place;
   * its current value is passed as the third argument to the menu's click
   * handler for every action item, so a sibling action (e.g. "Insert rows
   * above") can act on the chosen amount. A stepper row is not itself
   * clickable and does not close the menu.
   */
  type?: "action" | "stepper";
  /** Minimum value for a `stepper` item (default 1). */
  min?: number;
  /** Maximum value for a `stepper` item (default 1000). */
  max?: number;
  /** Initial value for a `stepper` item (default `min`). */
  value?: number;
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
