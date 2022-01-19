import {CommonModule} from '@angular/common'
import {NgModule} from '@angular/core'
import {BrowserModule} from '@angular/platform-browser'
import {DebugModule} from '@logi-sheets/web/debug'

import {BottomBarModule} from '@logi-sheets/web/app/bottom-bar'
import {ContentModule} from '@logi-sheets/web/app/content'
import {TopBarModule} from '@logi-sheets/web/app/top-bar'
import {DataService} from '@logi-sheets/web/core/data'
import {WebSocketService} from '@logi-sheets/web/ws'
import {DragDropModule} from '@angular/cdk/drag-drop'

import {SpreadsheetRootComponent} from './spreadsheet-root.component'

@NgModule({
    declarations: [
        SpreadsheetRootComponent,
    ],
    exports: [
        SpreadsheetRootComponent,
    ],
    imports: [
        BottomBarModule,
        BrowserModule,
        CommonModule,
        ContentModule,
        DebugModule,
        DragDropModule,
        TopBarModule,
    ],
    providers: [
        DataService,
        WebSocketService,
    ],
})
export class SpreadsheetRootModule { }
