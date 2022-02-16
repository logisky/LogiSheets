import {StandardFont} from 'core/standable'
export class Settings {
    public leftTop = new LeftTop()
    public grid = new Grid()
    public fixedHeader = new FixedHeaderStyle()
    public defaultCellSize = {width: 40, height: 25}
    public showContextMenu = true
    public showToolBar = true
    public showSheetsTab = true
    public topBar = '102px'
    public bottomBar = '0'
    public defaultSheetName = 'sheet'
    public scrollbarSize = 16
    public emptyFillColor = 'white'
    public wsUrl = 'ws://localhost:8081/ws/'
}

export class Grid {
    public showHorizontal = false
    public showVertical = false
    public fillStyle = '#ffffff'
    public strokeStyle = '#000000'
    public lineWidth = 1
}


export class LeftTop {
    public width = 32
    public height = 24
    /**
     * Fixed header content color.
     */
    public strokeStyle = '#f4f5f8'
}

export class FixedHeaderStyle {
    public font = new StandardFont()
}
export const SETTINGS = new Settings()
