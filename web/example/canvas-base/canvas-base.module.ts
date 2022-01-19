import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { CanvasBaseDirective } from './canvas-base.directive'

@NgModule({
  declarations: [
    CanvasBaseDirective
  ],
  imports: [
    CommonModule
  ],
  exports: [
    CanvasBaseDirective
  ]
})
export class CanvasBaseModule { }
