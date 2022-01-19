import {NgModule} from '@angular/core'
import {BrowserModule} from '@angular/platform-browser'
import {BrowserAnimationsModule} from '@angular/platform-browser/animations'

import {AppComponent} from './app.component'
import {CanvasModule} from './canvas'
import {CopyPasteModule} from './copy-paste'
import {ImgViewerModule} from './img-viewer'
import {GridModule} from './grid'
import {TextModule} from './text'
import {TranslateModule} from './translate'
import {RectModule} from './rect'
import {MouseeventModule} from './mouseevent'
import {KeycodeModule} from './keycode'
import {TextareaCanvasModule} from './textarea-canvas'

@NgModule({
    bootstrap: [AppComponent],
    declarations: [AppComponent],
    imports: [
        BrowserAnimationsModule,
        BrowserModule,
        CanvasModule,
        CopyPasteModule,
        GridModule,
        ImgViewerModule,
        KeycodeModule,
        MouseeventModule,
        RectModule,
        TextModule,
        TextareaCanvasModule,
        TranslateModule,
    ],
})
export class AppModule { }
