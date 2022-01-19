import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {AppComponent} from './app.component'
import {SpreadsheetRootModule} from './spreadsheet-root'
import {BrowserModule} from '@angular/platform-browser'
import {BrowserAnimationsModule} from '@angular/platform-browser/animations'

@NgModule({
    declarations: [
        AppComponent,
    ],
    bootstrap: [AppComponent],
    imports: [
        BrowserAnimationsModule,
        BrowserModule,
        CommonModule,
        SpreadsheetRootModule,
    ],
    exports: [
        AppComponent,
    ],
})
export class AppModule { }
