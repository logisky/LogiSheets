/**
 * React adapter for logisheets-engine Svelte components.
 * This module provides React wrappers around the Svelte components,
 * allowing seamless integration with LogiSheets React application.
 */
import type { SelectedData, SheetInfo, CellLayout } from "logisheets-web";
import type { Grid, EngineConfig } from "$types/index";
import type { ContextMenuItem, ContextMenuContext } from "../components/contextMenuTypes";
/**
 * Props for the React Spreadsheet component adapter.
 * These mirror the Svelte component props but follow React conventions.
 */
export interface SpreadsheetAdapterProps {
    /** Currently selected data */
    selectedData?: SelectedData;
    /** Active sheet index */
    activeSheet?: number;
    /** Cell layouts for custom rendering */
    cellLayouts?: CellLayout[];
    /** Engine configuration */
    config?: Partial<EngineConfig>;
    /** Show sheet tabs at bottom */
    showSheetTabs?: boolean;
    /** Show scrollbars */
    showScrollbars?: boolean;
    /** Custom context menu items */
    contextMenuItems?: ContextMenuItem[];
    /** Callback when selection changes */
    onSelectedDataChange?: (data: SelectedData) => void;
    /** Callback when active sheet changes */
    onActiveSheetChange?: (sheet: number) => void;
    /** Callback when grid updates */
    onGridChange?: (grid: Grid | null) => void;
    /** Callback when sheets list changes */
    onSheetsChange?: (sheets: readonly SheetInfo[]) => void;
    /** Callback when context menu item is clicked */
    onContextMenuItemClick?: (item: ContextMenuItem, context: ContextMenuContext | null) => void;
}
/**
 * LogiSheets-compatible props that follow the existing LogiSheets naming conventions.
 * Use this interface when migrating from LogiSheets Canvas component.
 */
export interface CanvasAdapterProps {
    selectedData: SelectedData;
    selectedData$: (e: SelectedData) => void;
    activeSheet: number;
    activeSheet$: (s: number) => void;
    selectedDataContentChanged$: (e: object) => void;
    grid: Grid | null;
    setGrid: (grid: Grid | null) => void;
    cellLayouts: CellLayout[];
}
/**
 * Convert LogiSheets-style props to engine adapter props.
 * This helps when migrating from the existing LogiSheets Canvas component.
 */
export declare function convertCanvasPropsToAdapterProps(props: CanvasAdapterProps): SpreadsheetAdapterProps;
/**
 * Hook configuration for creating a React-integrated spreadsheet instance.
 * This can be used with custom React hooks to manage spreadsheet state.
 */
export interface UseSpreadsheetConfig {
    /** Initial selected data */
    initialSelectedData?: SelectedData;
    /** Initial active sheet index */
    initialActiveSheet?: number;
    /** Engine configuration */
    config?: Partial<EngineConfig>;
}
/**
 * Return type for useSpreadsheet hook (to be implemented in React wrapper package)
 */
export interface UseSpreadsheetReturn {
    /** Current selected data */
    selectedData: SelectedData;
    /** Set selected data */
    setSelectedData: (data: SelectedData) => void;
    /** Current active sheet */
    activeSheet: number;
    /** Set active sheet */
    setActiveSheet: (sheet: number) => void;
    /** Current grid */
    grid: Grid | null;
    /** Current sheets list */
    sheets: readonly SheetInfo[];
    /** Props to spread on the Spreadsheet component */
    spreadsheetProps: SpreadsheetAdapterProps;
}
