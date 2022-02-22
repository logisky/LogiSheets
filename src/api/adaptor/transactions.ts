import { Transaction, PayloadsTransaction, UndoTransaction, RedoTransaction } from '../transactions'
import { Transaction as ProtoTransaction , Payload as ProtoPayload, ShiftType, underlineTypeFromJSON } from '../../proto/message'
import { Payload, SetFont, SetBorder } from "../payloads";

export function adaptTransaction(t: Transaction): ProtoTransaction {
    if (t instanceof UndoTransaction)
        return {undo: true, undoable: false, payloads: [], redo: false}
    if (t instanceof RedoTransaction) {
        return {undo: false, undoable: false, payloads:[], redo: true}
    }
    if (t instanceof PayloadsTransaction) {
        const transaction = t
        const protoPayloads: ProtoPayload[] = []
        transaction.payloads.forEach(p => {
            protoPayloads.push(...adaptPayload(p))
        })
        return {undo: false, undoable: false, payloads: protoPayloads, redo: false}
    }
    throw Error('unknown transaction type!')
}

export function adaptPayload(p: Payload): readonly ProtoPayload[] {
    switch (p.type) {
    case 'sheetRename':
        return [{
            payloadOneof: {
                $case: 'sheetRename',
                sheetRename: {
                    oldName: p.oldName,
                    newName: p.newName,
                }
            }
        }]
    case 'cellInput':
        return [{
            payloadOneof: {
                $case: 'cellInput',
                cellInput: {
                    sheetIdx: p.sheetIdx,
                    row: p.row,
                    col: p.col,
                    input: p.input,
                }
            }
        }]
    case 'insertRows':
        return [{
            payloadOneof: {
                $case: 'rowShift',
                rowShift: {
                    sheetIdx: p.sheetIdx,
                    start: p.start,
                    count: p.cnt,
                    type: ShiftType.INSERT
                }
            }
        }]
    case 'deleteRows':
        return [{
            payloadOneof: {
                $case: 'rowShift',
                rowShift: {
                    sheetIdx: p.sheetIdx,
                    start: p.start,
                    count: p.cnt,
                    type: ShiftType.DELETE
                }
            }
        }]
    case 'insertCols':
        return [{
            payloadOneof: {
                $case: 'columnShift',
                columnShift: {
                    sheetIdx: p.sheetIdx,
                    start: p.start,
                    count: p.cnt,
                    type: ShiftType.INSERT
                }
            }
        }]
    case 'deleteCols':
        return [{
            payloadOneof: {
                $case: 'columnShift',
                columnShift: {
                    sheetIdx: p.sheetIdx,
                    start: p.start,
                    count: p.cnt,
                    type: ShiftType.DELETE
                }
            }
        }]
    case 'createBlock':
        return [{
            payloadOneof: {
                $case: 'createBlock',
                createBlock: {
                    sheetIdx: p.sheetIdx,
                    id: p.blockId,
                    masterRow: p.masterRow,
                    masterCol: p.masterCol,
                    rowCnt: p.rowCnt,
                    colCnt: p.colCnt,
                }
            }
        }]
    case 'moveBlock':
        return [{
            payloadOneof: {
                $case: 'moveBlock',
                moveBlock: {
                    sheetIdx: p.sheetIdx,
                    id: p.blockId,
                    newMasterRow: p.newMasterRow,
                    newMasterCol: p.newMasterCol,
                }
            }
        }]
    case 'setColWidth':
        return [{
            payloadOneof: {
                $case: 'setColWidth',
                setColWidth: {
                    sheetIdx: p.sheetIdx,
                    col: p.col,
                    width: p.width,
                }
            }
        }]
    case 'setRowHeight':
        return [{
            payloadOneof: {
                $case: 'setRowHeight',
                setRowHeight: {
                    sheetIdx: p.sheetIdx,
                    row: p.row,
                    height: p.height,
                }
            }
        }]
    case 'setRowVisible':
        return [{
            payloadOneof: {
                $case: 'setRowVisible',
                setRowVisible: {
                    sheetIdx: p.sheetIdx,
                    row: p.row,
                    visible: p.visible,
                }
            }
        }]
    case 'setColVisible':
        return [{
            payloadOneof: {
                $case: 'setColVisible',
                setColVisible: {
                    sheetIdx: p.sheetIdx,
                    col: p.col,
                    visible: p.visible,
                }
            }
        }]
    case 'insertBlockRows':
        return [{
            payloadOneof: {
                $case: 'lineShiftInBlock',
                lineShiftInBlock: {
                    sheetIdx: p.sheetIdx,
                    id: p.blockId,
                    idx: p.rowIdx,
                    cnt: p.cnt,
                    horizontal: true,
                    insert: true,
                },
            }
        }]
    case 'insertBlockCols':
        return [{
            payloadOneof: {
                $case: 'lineShiftInBlock',
                lineShiftInBlock: {
                    sheetIdx: p.sheetIdx,
                    id: p.blockId,
                    idx: p.colIdx,
                    cnt: p.cnt,
                    horizontal: false,
                    insert: true,
                },
            }
        }]
    case 'deleteBlockRows':
        return [{
            payloadOneof: {
                $case: 'lineShiftInBlock',
                lineShiftInBlock: {
                    sheetIdx: p.sheetIdx,
                    id: p.blockId,
                    idx: p.rowIdx,
                    cnt: p.cnt,
                    horizontal: true,
                    insert: false,
                },
            }
        }]
    case 'deleteBlockCols':
        return [{
            payloadOneof: {
                $case: 'lineShiftInBlock',
                lineShiftInBlock: {
                    sheetIdx: p.sheetIdx,
                    id: p.blockId,
                    idx: p.colIdx,
                    cnt: p.cnt,
                    horizontal: false,
                    insert: false,
                },
            }
        }]
    case 'setFont':
        return adapatSetFont(p)
    case 'setBorder':
        return adaptSetBorder(p)
    case 'deleteSheet':
        return [{
            payloadOneof: {
                $case: 'sheetShift',
                sheetShift: {
                    sheetIdx: p.sheetIdx,
                    type: ShiftType.DELETE
                }
            }
        }]
    case 'insertSheet':
        return [{
            payloadOneof: {
                $case: 'sheetShift',
                sheetShift: {
                    sheetIdx: p.sheetIdx,
                    type: ShiftType.INSERT
                }
            }
        }]
    default:
        throw Error(`unimplemented: ${p}`)
    }
}

function adapatSetFont(p: SetFont): readonly ProtoPayload[] {
    const result: ProtoPayload[] = []
    if (p.bold)
        result.push({
            payloadOneof: {
                $case: 'styleUpdate',
                styleUpdate: {
                    sheetIdx: p.sheetIdx,
                    row: p.row,
                    col: p.col,
                    payload: {stylePayloadOneof: {
                        $case: 'setFontBold',
                        setFontBold: {bold: p.bold}
                    }}
                }
            }
        })
    if (p.italic)
        result.push({
            payloadOneof: {
                $case: 'styleUpdate',
                styleUpdate: {
                    sheetIdx: p.sheetIdx,
                    row: p.row,
                    col: p.col,
                    payload: {stylePayloadOneof: {
                        $case: 'setFontItalic',
                        setFontItalic: {italic: p.italic},
                    }}
                }
            }
        })
    if (p.underline)
        result.push({
            payloadOneof: {
                $case: 'styleUpdate',
                styleUpdate: {
                    sheetIdx: p.sheetIdx,
                    row: p.row,
                    col: p.col,
                    payload: {stylePayloadOneof: {
                        $case: 'setFontUnderline',
                        setFontUnderline: {
                            underline: underlineTypeFromJSON(p.underline),
                        },
                    }}
                }
            }
        })
    if (p.color)
        result.push({
            payloadOneof: {
                $case: 'styleUpdate',
                styleUpdate: {
                    sheetIdx: p.sheetIdx,
                    row: p.row,
                    col: p.col,
                    payload: {stylePayloadOneof: {
                        $case: 'setFontColor',
                        setFontColor: {
                            color: p.color,
                        },
                    }}
                }
            }
        })
    if (p.size) {
        result.push({
            payloadOneof: {
                $case: 'styleUpdate',
                styleUpdate: {
                    sheetIdx: p.sheetIdx,
                    row: p.row,
                    col: p.col,
                    payload: {stylePayloadOneof: {
                        $case: 'setFontSize',
                        setFontSize: {
                            size: p.size,
                        },
                    }}
                }
            }
        })
    }
    if (p.name) {
        result.push({
            payloadOneof: {
                $case: 'styleUpdate',
                styleUpdate: {
                    sheetIdx: p.sheetIdx,
                    row: p.row,
                    col: p.col,
                    payload: {stylePayloadOneof: {
                        $case: 'setFontName',
                        setFontName: {
                            name: p.name,
                        },
                    }}
                }
            }
        })
    }
    if (p.outline) {
        result.push({
            payloadOneof: {
                $case: 'styleUpdate',
                styleUpdate: {
                    sheetIdx: p.sheetIdx,
                    row: p.row,
                    col: p.col,
                    payload: {stylePayloadOneof: {
                        $case: 'setFontOutline',
                        setFontOutline: {
                            outline: p.outline,
                        },
                    }}
                }
            }
        })
    }
    if (p.shadow) {
        result.push({
            payloadOneof: {
                $case: 'styleUpdate',
                styleUpdate: {
                    sheetIdx: p.sheetIdx,
                    row: p.row,
                    col: p.col,
                    payload: {stylePayloadOneof: {
                        $case: 'setFontShadow',
                        setFontShadow: {
                            shadow: p.shadow,
                        },
                    }}
                }
            }
        })
    }
    if (p.strike)
        result.push({
            payloadOneof: {
                $case: 'styleUpdate',
                styleUpdate: {
                    sheetIdx: p.sheetIdx,
                    row: p.row,
                    col: p.col,
                    payload: {stylePayloadOneof: {
                        $case: 'setFontStrike',
                        setFontStrike: {
                            strike: p.strike,
                        },
                    }}
                }
            }
        })
    if (p.condense)
        result.push({
            payloadOneof: {
                $case: 'styleUpdate',
                styleUpdate: {
                    sheetIdx: p.sheetIdx,
                    row: p.row,
                    col: p.col,
                    payload: {stylePayloadOneof: {
                        $case: 'setFontCondense',
                        setFontCondense: {
                            condense: p.condense,
                        },
                    }}
                }
            }
        })
    return result
}

function adaptSetBorder(p: SetBorder): readonly ProtoPayload[] {
    throw Error('unimplemented!')
}
