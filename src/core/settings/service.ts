import {StandardFont} from '@/core/standable'

// TODO: move the configs related to view to the view service
class Settings {
    public leftTop = new LeftTop()
    public grid = new Grid()
    public fixedHeader = new FixedHeaderStyle()
    /**
     * unit: pt
     */
    public defaultCellSize = {width: 6, height: 25}
    public showContextMenu = true
    public showToolBar = true
    public showSheetsTab = true
    public topBar = '46px'
    public bottomBar = '0'
    public defaultSheetName = 'sheet'
    public scrollbarSize = 16
    public emptyFillColor = 'white'
}

export class Grid {
    public showHorizontal = true
    public showVertical = true
    public fillStyle = '#ffffff'
    public strokeStyle = '#000000'
    public lineWidth = 1
}

export class LeftTop {
    public static width = 32
    public static height = 24
    /**
     * Fixed header content color.
     */
    public static strokeStyle = '#f4f5f8'
}

export class FixedHeaderStyle {
    public font = new StandardFont()
}
export const SETTINGS = new Settings()
