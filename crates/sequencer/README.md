# LogiSheets Sequencer

`Sequencer` is a server to enable users to edit the same file in `LogiSheets`.

`Sequencer` is responsible for determining the action orders, dealing with the conflicts, and broadcasting them to user sides. Since every standalone state machine will receive the same instructions from the `Sequencer`, it is guaranteed that every user gets the same result.
