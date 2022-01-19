import {NgModule} from '@angular/core'
import {ReactiveFormsModule, FormsModule} from '@angular/forms'
import {CommonModule} from '@angular/common'
import {DebugComponent} from './debug.component'
import {MatFormFieldModule} from '@angular/material/form-field'
import {MatAutocompleteModule} from '@angular/material/autocomplete'
import {MatIconModule} from '@angular/material/icon'
import {MatInputModule} from '@angular/material/input'
import {MatSelectModule} from '@angular/material/select'
import {MatDialogModule} from '@angular/material/dialog'
import {MatButtonModule} from '@angular/material/button'
import {PayloadComponent} from './payload.component'

@NgModule({
    declarations: [
        DebugComponent,
        PayloadComponent,
    ],
    imports: [
        CommonModule,
        FormsModule,
        MatAutocompleteModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        ReactiveFormsModule,
    ],
    exports: [
        DebugComponent,
    ],
})
export class DebugModule { }
