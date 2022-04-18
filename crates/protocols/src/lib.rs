use prost::Message;
use std::io::Cursor;

pub mod message {
    include!(concat!(env!("OUT_DIR"), "/protocols.rs"));

    use logisheets_controller::controller::display::CellFormulaValue;
    use logisheets_controller::controller::display::CellStyle as ControllerCellStyle;
    use logisheets_controller::controller::display::DisplayPatch as ControllerDisplayPatch;
    use logisheets_controller::controller::display::DisplayResponse as ControllerResponse;
    use logisheets_controller::controller::display::Style as ControllerStyle;
    use logisheets_controller::controller::display::Value as ControllerValue;
    use logisheets_controller::controller::edit_action::style_payload::BorderLocation as CtrlBorderLocation;
    use logisheets_controller::controller::edit_action::style_payload::SetBorderStyle;
    use logisheets_controller::controller::edit_action::style_payload::SetPatternFill as CtrlSetPatternFill;
    use logisheets_controller::controller::edit_action::EditAction;
    use logisheets_controller::controller::edit_action::{self, EditPayload};
    use logisheets_workbook::prelude::CtBorder as WbBorder;
    use logisheets_workbook::prelude::CtBorderPr as WbBorderPr;
    use logisheets_workbook::prelude::CtCellAlignment;
    use logisheets_workbook::prelude::CtColor;
    use logisheets_workbook::prelude::CtFill as WbFill;
    use logisheets_workbook::prelude::CtFont as WbFont;
    use logisheets_workbook::prelude::CtPatternFill as WbPatternFill;
    use logisheets_workbook::prelude::StBorderStyle;
    use logisheets_workbook::prelude::StPatternType;
    use logisheets_workbook::prelude::StUnderlineValues;
    use logisheets_workbook::prelude::{StHorizontalAlignment, StVerticalAlignment};

    impl DisplayResponse {
        pub fn from(res: ControllerResponse) -> Self {
            DisplayResponse {
                patches: res
                    .patches
                    .into_iter()
                    .map(|p| DisplayPatch::from(p))
                    .collect(),
            }
        }
    }

    impl CellValue {
        pub fn from(c: CellFormulaValue) -> Self {
            CellValue {
                row: c.row as u32,
                col: c.col as u32,
                value: Some(Value::from(c.value)),
                formula: c.formula,
            }
        }
    }

    impl DisplayPatch {
        pub fn from(patch: ControllerDisplayPatch) -> Self {
            use display_patch::DisplayPatchOneof;
            match patch {
                ControllerDisplayPatch::Values(v) => {
                    let values = SheetValues {
                        sheet_idx: v.sheet_idx as u32,
                        values: v.values.into_iter().map(|a| CellValue::from(a)).collect(),
                    };
                    DisplayPatch {
                        display_patch_oneof: Some(DisplayPatchOneof::Values(values)),
                    }
                }
                ControllerDisplayPatch::Styles(s) => {
                    let style = SheetStyles {
                        sheet_idx: s.sheet_idx as u32,
                        styles: s.styles.into_iter().map(|b| CellStyle::from(b)).collect(),
                    };
                    DisplayPatch {
                        display_patch_oneof: Some(DisplayPatchOneof::Styles(style)),
                    }
                }
                ControllerDisplayPatch::RowInfo(ri) => {
                    let row_info = SheetRowInfo {
                        sheet_idx: ri.sheet_idx as u32,
                        info: ri.info.into_iter().map(|r| RowInfo::from(r)).collect(),
                        default_height: ri.default_height,
                    };
                    DisplayPatch {
                        display_patch_oneof: Some(DisplayPatchOneof::RowInfo(row_info)),
                    }
                }
                ControllerDisplayPatch::ColInfo(ci) => {
                    let col_info = SheetColInfo {
                        sheet_idx: ci.sheet_idx as u32,
                        info: ci.info.into_iter().map(|r| ColInfo::from(r)).collect(),
                        default_width: ci.default_width,
                    };
                    DisplayPatch {
                        display_patch_oneof: Some(DisplayPatchOneof::ColInfo(col_info)),
                    }
                }
                ControllerDisplayPatch::MergeCells(mcs) => {
                    let merge_cells = SheetMergeCells {
                        idx: mcs.sheet_idx as u32,
                        merge_cells: mcs
                            .merge_cells
                            .into_iter()
                            .map(|a| MergeCell::from(a))
                            .collect(),
                    };
                    DisplayPatch {
                        display_patch_oneof: Some(DisplayPatchOneof::MergeCells(merge_cells)),
                    }
                }
                ControllerDisplayPatch::Comments(sc) => {
                    let sheet_comments = SheetComments {
                        idx: sc.sheet_idx as u32,
                        comment: sc.comments.into_iter().map(|c| Comment::from(c)).collect(),
                    };
                    DisplayPatch {
                        display_patch_oneof: Some(DisplayPatchOneof::Comments(sheet_comments)),
                    }
                }
                ControllerDisplayPatch::Blocks(sb) => {
                    let sheet_blocks = SheetBlocks {
                        sheet_idx: sb.sheet_idx as u32,
                        block_info: sb.blocks.into_iter().map(|b| BlockInfo::from(b)).collect(),
                    };
                    DisplayPatch {
                        display_patch_oneof: Some(DisplayPatchOneof::Blocks(sheet_blocks)),
                    }
                }
            }
        }
    }

    impl BlockInfo {
        pub fn from(bi: logisheets_controller::controller::display::BlockInfo) -> Self {
            BlockInfo {
                block_id: bi.block_id as u32,
                row_start: bi.row_start as u32,
                col_start: bi.col_start as u32,
                row_cnt: bi.row_cnt as u32,
                col_cnt: bi.col_cnt as u32,
            }
        }
    }

    impl MergeCell {
        pub fn from(mc: logisheets_controller::controller::display::MergeCell) -> Self {
            MergeCell {
                start_row: mc.row_start as u32,
                start_col: mc.col_start as u32,
                end_row: mc.row_end as u32,
                end_col: mc.col_end as u32,
            }
        }
    }

    impl Comment {
        pub fn from(comment: logisheets_controller::controller::display::Comment) -> Self {
            Comment {
                row: comment.row as u32,
                col: comment.col as u32,
                author: comment.author,
                content: comment.content,
            }
        }
    }

    impl Value {
        pub fn from(v: ControllerValue) -> Self {
            use value::CellValueOneof;
            let cv = match v {
                ControllerValue::Str(t) => CellValueOneof::Str(t),
                ControllerValue::Bool(b) => CellValueOneof::Bool(b),
                ControllerValue::Number(n) => CellValueOneof::Number(n),
                ControllerValue::Error(e) => CellValueOneof::Error(e),
                ControllerValue::Empty => todo!(),
            };
            Value {
                cell_value_oneof: Some(cv),
            }
        }
    }

    impl RowInfo {
        pub fn from(info: logisheets_controller::controller::display::RowInfo) -> Self {
            RowInfo {
                height: info.height,
                hidden: info.hidden,
                idx: info.idx as u32,
            }
        }
    }

    impl ColInfo {
        pub fn from(info: logisheets_controller::controller::display::ColInfo) -> Self {
            ColInfo {
                width: info.width,
                hidden: info.hidden,
                idx: info.idx as u32,
            }
        }
    }

    impl BorderLocation {
        pub fn into_ctrl(l: i32) -> CtrlBorderLocation {
            let s: BorderLocation = unsafe { std::mem::transmute(l) };
            match s {
                BorderLocation::Left => CtrlBorderLocation::Left,
                BorderLocation::Right => CtrlBorderLocation::Right,
                BorderLocation::Top => CtrlBorderLocation::Top,
                BorderLocation::Bottom => CtrlBorderLocation::Bottom,
                BorderLocation::Diagonal => CtrlBorderLocation::Diagonal,
                BorderLocation::Vertical => CtrlBorderLocation::Vertical,
                BorderLocation::Horizontal => CtrlBorderLocation::Horizontal,
            }
        }
    }

    impl Transaction {
        pub fn into(self) -> EditAction {
            if self.undo {
                EditAction::Undo
            } else if self.redo {
                EditAction::Redo
            } else {
                let raw_payloads = self.payloads;
                let payloads = raw_payloads
                    .into_iter()
                    .map(|p| -> EditPayload {
                        use payload::PayloadOneof;
                        match p.payload_oneof.unwrap() {
                            PayloadOneof::CellInput(c) => {
                                let ci = edit_action::CellInput {
                                    sheet_idx: c.sheet_idx as usize,
                                    row: c.row as usize,
                                    col: c.col as usize,
                                    content: c.input,
                                };
                                EditPayload::CellInput(ci)
                            }
                            PayloadOneof::RowShift(r) => {
                                let rs = edit_action::RowShift {
                                    sheet_idx: r.sheet_idx as usize,
                                    start: r.start as usize,
                                    count: r.count as usize,
                                    insert: r.r#type == ShiftType::Insert as i32,
                                };
                                EditPayload::RowShift(rs)
                            }
                            PayloadOneof::ColumnShift(c) => {
                                let cs = edit_action::ColShift {
                                    sheet_idx: c.sheet_idx as usize,
                                    start: c.start as usize,
                                    count: c.count as usize,
                                    insert: c.r#type == ShiftType::Insert as i32,
                                };
                                EditPayload::ColShift(cs)
                            }
                            PayloadOneof::SheetRename(_) => todo!(),
                            PayloadOneof::SheetShift(_) => todo!(),
                            PayloadOneof::StyleUpdate(su) => into_style_update(su),
                            PayloadOneof::CreateBlock(cb) => {
                                let p = edit_action::CreateBlock {
                                    sheet_idx: cb.sheet_idx as usize,
                                    id: cb.id as usize,
                                    master_row: cb.master_row as usize,
                                    master_col: cb.master_col as usize,
                                    row_cnt: cb.row_cnt as usize,
                                    col_cnt: cb.col_cnt as usize,
                                };
                                EditPayload::CreateBlock(p)
                            }
                            PayloadOneof::MoveBlock(mb) => {
                                let p = edit_action::MoveBlock {
                                    sheet_idx: mb.sheet_idx as usize,
                                    id: mb.id as usize,
                                    new_master_row: mb.new_master_row as usize,
                                    new_master_col: mb.new_master_col as usize,
                                };
                                EditPayload::MoveBlock(p)
                            }
                            PayloadOneof::BlockInput(bi) => {
                                let p = edit_action::BlockInput {
                                    sheet_idx: bi.sheet_idx as usize,
                                    id: bi.id as usize,
                                    row: bi.row as usize,
                                    col: bi.col as usize,
                                    input: bi.input,
                                };
                                EditPayload::BlockInput(p)
                            }
                            PayloadOneof::BlockStyleUpdate(bsu) => {
                                todo!()
                            }
                            PayloadOneof::LineShiftInBlock(lsib) => {
                                let p = edit_action::LineShiftInBlock {
                                    sheet_idx: lsib.sheet_idx as usize,
                                    id: lsib.id as usize,
                                    idx: lsib.idx as usize,
                                    cnt: lsib.cnt as usize,
                                    horizontal: lsib.horizontal,
                                    insert: lsib.insert,
                                };
                                EditPayload::LineShiftInBlock(p)
                            }
                            PayloadOneof::SetRowHeight(srh) => {
                                let p = edit_action::SetRowHeight {
                                    sheet_idx: srh.sheet_idx as usize,
                                    idx: srh.row as usize,
                                    height: srh.height,
                                };
                                EditPayload::SetRowHeight(p)
                            }
                            PayloadOneof::SetColWidth(scw) => {
                                let p = edit_action::SetColWidth {
                                    sheet_idx: scw.sheet_idx as usize,
                                    idx: scw.col as usize,
                                    width: scw.width,
                                };
                                EditPayload::SetColWidth(p)
                            }
                            PayloadOneof::SetRowVisible(_) => todo!(),
                            PayloadOneof::SetColVisible(_) => todo!(),
                        }
                    })
                    .collect::<Vec<_>>();
                EditAction::Payloads(payloads)
            }
        }
    }

    fn into_style_update(input: StyleUpdate) -> EditPayload {
        use edit_action::style_payload::{SetFontUnderline, StyleUpdateType};
        use style_update_payload::StylePayloadOneof;
        let ps = input
            .payloads
            .into_iter()
            .map(|p| {
                let p = p.style_payload_oneof.unwrap();
                match p {
                    StylePayloadOneof::SetFontBold(fb) => StyleUpdateType::SetFontBold(fb.bold),
                    StylePayloadOneof::SetFontItalic(fi) => {
                        StyleUpdateType::SetFontItalic(fi.italic)
                    }
                    StylePayloadOneof::SetFontUnderline(fu) => {
                        let underline = match fu.underline {
                            0 => StUnderlineValues::Double,
                            1 => StUnderlineValues::DoubleAccounting,
                            2 => StUnderlineValues::None,
                            3 => StUnderlineValues::Single,
                            4 => StUnderlineValues::SingleAccounting,
                            _ => StUnderlineValues::None,
                        };
                        StyleUpdateType::SetFontUnderline(SetFontUnderline { underline })
                    }
                    StylePayloadOneof::SetFontColor(fc) => StyleUpdateType::SetFontColor(fc.color),
                    StylePayloadOneof::SetFontSize(fs) => StyleUpdateType::SetFontSize(fs.size),
                    StylePayloadOneof::SetFontName(fname) => {
                        StyleUpdateType::SetFontName(fname.name)
                    }
                    StylePayloadOneof::SetFontOutline(fo) => {
                        StyleUpdateType::SetFontOutline(fo.outline)
                    }
                    StylePayloadOneof::SetFontShadow(fs) => {
                        StyleUpdateType::SetFontShadow(fs.shadow)
                    }
                    StylePayloadOneof::SetFontStrike(fs) => {
                        StyleUpdateType::SetFontStrike(fs.strike)
                    }
                    StylePayloadOneof::SetFontCondense(fc) => {
                        StyleUpdateType::SetFontCondense(fc.condense)
                    }
                    StylePayloadOneof::SetBorderDiagonalUp(_) => todo!(),
                    StylePayloadOneof::SetBorderDiagonalDown(_) => todo!(),
                    StylePayloadOneof::SetBorderOutline(_) => todo!(),
                    StylePayloadOneof::SetPatternFill(set_fill) => {
                        let pf = set_fill.pattern_fill.unwrap();
                        let fill = pf.into();
                        if let WbFill::PatternFill(p) = fill {
                            let s = CtrlSetPatternFill { pattern_fill: p };
                            StyleUpdateType::SetPatternFill(s)
                        } else {
                            todo!()
                        }
                    }
                    StylePayloadOneof::SetLeftBorderColor(c) => {
                        StyleUpdateType::SetLeftBorderColor(c.color)
                    }
                    StylePayloadOneof::SetRightBorderColor(c) => {
                        StyleUpdateType::SetRightBorderColor(c.color)
                    }
                    StylePayloadOneof::SetTopBorderColor(c) => {
                        StyleUpdateType::SetTopBorderColor(c.color)
                    }
                    StylePayloadOneof::SetBottomBorderColor(c) => {
                        StyleUpdateType::SetBottomBorderColor(c.color)
                    }
                    StylePayloadOneof::SetLeftBorderType(s) => {
                        let ty = convert_border_style(s.bt);
                        StyleUpdateType::SetLeftBorderStyle(SetBorderStyle { ty })
                    }
                    StylePayloadOneof::SetRightBorderType(s) => {
                        let ty = convert_border_style(s.bt);
                        StyleUpdateType::SetRightBorderStyle(SetBorderStyle { ty })
                    }
                    StylePayloadOneof::SetTopBorderType(s) => {
                        let ty = convert_border_style(s.bt);
                        StyleUpdateType::SetTopBorderStyle(SetBorderStyle { ty })
                    }
                    StylePayloadOneof::SetBottomBorderType(s) => {
                        let ty = convert_border_style(s.bt);
                        StyleUpdateType::SetBottomBorderStyle(SetBorderStyle { ty })
                    }
                }
            })
            .collect();
        let sheet_idx = input.sheet_idx as usize;
        let row = input.row as usize;
        let col = input.col as usize;
        use logisheets_controller::controller::edit_action::style_payload::StyleUpdate;
        EditPayload::StyleUpdate(StyleUpdate {
            sheet_idx,
            row,
            col,
            ty: ps,
        })
    }

    impl Alignment {
        pub fn from(ca: CtCellAlignment) -> Self {
            Alignment {
                horizontal: match ca.horizontal {
                    Some(h) => match h {
                        StHorizontalAlignment::Center => alignment::Horizontal::HCenter as i32,
                        StHorizontalAlignment::CenterContinuous => {
                            alignment::Horizontal::HCenterContinuous as i32
                        }
                        StHorizontalAlignment::Distributed => {
                            alignment::Horizontal::HDistributed as i32
                        }
                        StHorizontalAlignment::Fill => alignment::Horizontal::HFill as i32,
                        StHorizontalAlignment::General => alignment::Horizontal::HGeneral as i32,
                        StHorizontalAlignment::Justify => alignment::Horizontal::HJustify as i32,
                        StHorizontalAlignment::Left => alignment::Horizontal::HLeft as i32,
                        StHorizontalAlignment::Right => alignment::Horizontal::HRight as i32,
                    },
                    None => alignment::Horizontal::HUnspecified as i32,
                },
                indent: match ca.indent {
                    Some(ident) => ident as i32,
                    None => 0,
                },
                justify_last_line: match ca.justify_last_line {
                    Some(b) => b,
                    None => false,
                },
                reading_order: match ca.reading_order {
                    Some(order) => match order {
                        0 => ReadingOrder::RContextDependent as i32,
                        1 => ReadingOrder::RLeftToRight as i32,
                        2 => ReadingOrder::RRightToLeft as i32,
                        _ => ReadingOrder::RLeftToRight as i32,
                    },
                    None => ReadingOrder::RLeftToRight as i32,
                },
                relative_indent: match ca.relative_indent {
                    Some(i) => i,
                    None => 0,
                },
                shrink_to_fit: match ca.shrink_to_fit {
                    Some(b) => b,
                    None => false,
                },
                text_rotation: match ca.text_rotation {
                    Some(tr) => tr as i32,
                    None => 0,
                },
                vertical: match ca.vertical {
                    Some(v) => match v {
                        StVerticalAlignment::Bottom => alignment::Vertical::VBottom as i32,
                        StVerticalAlignment::Center => alignment::Vertical::VCenter as i32,
                        StVerticalAlignment::Distributed => {
                            alignment::Vertical::VDistributed as i32
                        }
                        StVerticalAlignment::Justify => alignment::Vertical::VJustify as i32,
                        StVerticalAlignment::Top => alignment::Vertical::VTop as i32,
                    },
                    None => alignment::Vertical::VUnspecified as i32,
                },
                wrap_text: match ca.wrap_text {
                    Some(b) => b,
                    None => false,
                },
            }
        }
    }

    impl Style {
        pub fn from(cf: ControllerStyle) -> Self {
            let border = Border::from(cf.border);
            let fill = PatternFill::from(cf.fill);
            let font = Font::from(cf.font);
            let alignment = cf.alignment.and_then(|ca| Some(Alignment::from(ca)));
            Style {
                border: Some(border),
                font: Some(font),
                fill: Some(fill),
                alignment,
                formatter: String::from(""),
            }
        }
    }

    impl CellStyle {
        pub fn from(s: ControllerCellStyle) -> Self {
            CellStyle {
                row: s.row as u32,
                col: s.col as u32,
                style: Some(Style::from(s.style)),
            }
        }
    }

    fn convert_color(color: &Option<CtColor>) -> String {
        color.as_ref().map_or(String::from(""), |c| match &c.rgb {
            Some(c) => c.to_string(),
            None => match &c.indexed {
                Some(indexed) => match *indexed {
                    0 => String::from("00000000"),
                    1 => String::from("00FFFFFF"),
                    2 => String::from("00FF0000"),
                    3 => String::from("0000FF00"),
                    4 => String::from("000000FF"),
                    5 => String::from("00FFFF00"),
                    6 => String::from("00FF00FF"),
                    7 => String::from("0000FFFF"),
                    8 => String::from("00000000"),
                    9 => String::from("00FFFFFF"),
                    10 => String::from("00FF0000"),
                    11 => String::from("0000FF00"),
                    12 => String::from("000000FF"),
                    13 => String::from("00FFFF00"),
                    14 => String::from("00FF00FF"),
                    15 => String::from("0000FFFF"),
                    16 => String::from("00800000"),
                    17 => String::from("00008000"),
                    18 => String::from("00000080"),
                    19 => String::from("00808000"),
                    20 => String::from("00800080"),
                    21 => String::from("00008080"),
                    22 => String::from("00C0C0C0"),
                    23 => String::from("00808080"),
                    24 => String::from("009999FF"),
                    25 => String::from("00993366"),
                    26 => String::from("00FFFFCC"),
                    27 => String::from("00CCFFFF"),
                    28 => String::from("00660066"),
                    29 => String::from("00FF8080"),
                    30 => String::from("000066CC"),
                    31 => String::from("00CCCCFF"),
                    32 => String::from("00000080"),
                    33 => String::from("00FF00FF"),
                    34 => String::from("00FFFF00"),
                    35 => String::from("0000FFFF"),
                    36 => String::from("00800080"),
                    37 => String::from("00800000"),
                    38 => String::from("00008080"),
                    39 => String::from("000000FF"),
                    40 => String::from("0000CCFF"),
                    41 => String::from("00CCFFFF"),
                    42 => String::from("00CCFFCC"),
                    43 => String::from("00FFFF99"),
                    44 => String::from("0099CCFF"),
                    45 => String::from("00FF99CC"),
                    46 => String::from("00CC99FF"),
                    47 => String::from("00FFCC99"),
                    48 => String::from("003366FF"),
                    49 => String::from("0033CCCC"),
                    50 => String::from("0099CC00"),
                    51 => String::from("00FFCC00"),
                    52 => String::from("00FF9900"),
                    53 => String::from("00FF6600"),
                    54 => String::from("00666699"),
                    55 => String::from("00969696"),
                    56 => String::from("00003366"),
                    57 => String::from("00339966"),
                    58 => String::from("00003300"),
                    59 => String::from("00333300"),
                    60 => String::from("00993300"),
                    61 => String::from("00993366"),
                    62 => String::from("00333399"),
                    63 => String::from("00333333"),
                    _ => String::from(""),
                },
                None => String::from(""),
            },
        })
    }

    impl Font {
        pub fn from(font: WbFont) -> Self {
            let bold = font.bold;
            let italic = font.italic;
            let underline = font
                .underline
                .as_ref()
                .map_or(UnderlineType::None, |u| match &u.val {
                    StUnderlineValues::Double => UnderlineType::DoubleU,
                    StUnderlineValues::DoubleAccounting => UnderlineType::DoubleAccounting,
                    StUnderlineValues::None => UnderlineType::None,
                    StUnderlineValues::Single => UnderlineType::Single,
                    StUnderlineValues::SingleAccounting => UnderlineType::SingleAccounting,
                }) as i32;
            let color = convert_color(&font.color);
            let size = font.sz.as_ref().map_or(11_f64, |fs| fs.val);
            let name = font
                .name
                .as_ref()
                .map_or(String::from(""), |f| f.val.to_string());
            let outline = font.outline;
            let shadow = font.shadow;
            let strike = font.strike;
            let condense = font.condense;
            Font {
                bold,
                italic,
                underline,
                color,
                size,
                name,
                outline,
                shadow,
                strike,
                condense,
            }
        }
    }

    impl Border {
        pub fn from(border: WbBorder) -> Self {
            let left = border
                .left
                .as_ref()
                .map_or(None, |pr| Some(BorderPr::from(pr)));
            let right = border
                .right
                .as_ref()
                .map_or(None, |pr| Some(BorderPr::from(pr)));
            let top = border
                .top
                .as_ref()
                .map_or(None, |pr| Some(BorderPr::from(pr)));
            let bottom = border
                .bottom
                .as_ref()
                .map_or(None, |pr| Some(BorderPr::from(pr)));
            let diagonal = border
                .diagonal
                .as_ref()
                .map_or(None, |pr| Some(BorderPr::from(pr)));
            let horizontal = border
                .horizontal
                .as_ref()
                .map_or(None, |pr| Some(BorderPr::from(pr)));
            let vertical = border
                .vertical
                .as_ref()
                .map_or(None, |pr| Some(BorderPr::from(pr)));
            let diagonal_up = border.diagonal_up.unwrap_or(false);
            let diagonal_down = border.diagonal_up.unwrap_or(false);
            let outline = border.outline;
            Border {
                left,
                right,
                top,
                bottom,
                diagonal,
                vertical,
                horizontal,
                diagonal_up,
                diagonal_down,
                outline,
            }
        }
    }

    impl BorderPr {
        pub fn from(pr: &WbBorderPr) -> Self {
            let color = convert_color(&pr.color);
            let ty = BorderType::from(&pr.style);
            BorderPr {
                color,
                r#type: ty as i32,
            }
        }

        pub fn into(self) -> WbBorderPr {
            WbBorderPr {
                color: Some(CtColor {
                    auto: None,
                    indexed: None,
                    rgb: Some(self.color),
                    theme: None,
                    tint: 0.0,
                }),
                style: BorderType::to(self.r#type),
            }
        }
    }

    impl BorderType {
        pub fn from(ty: &StBorderStyle) -> Self {
            match ty {
                StBorderStyle::DashDot => BorderType::DashDot,
                StBorderStyle::DashDotDot => BorderType::DashDotDot,
                StBorderStyle::Dashed => BorderType::Dashed,
                StBorderStyle::Dotted => BorderType::Dotted,
                StBorderStyle::Double => BorderType::Double,
                StBorderStyle::Hair => BorderType::Hair,
                StBorderStyle::Medium => BorderType::Medium,
                StBorderStyle::MediumDashDot => BorderType::MediumDashDot,
                StBorderStyle::MediumDashDotDot => BorderType::MediumDashDotDot,
                StBorderStyle::MediumDashed => BorderType::MediumDashed,
                StBorderStyle::None => BorderType::NoneBorder,
                StBorderStyle::SlantDashDot => BorderType::SlantDashDot,
                StBorderStyle::Thick => BorderType::Thick,
                StBorderStyle::Thin => BorderType::Thin,
            }
        }

        pub fn to(n: i32) -> StBorderStyle {
            let s: BorderType = unsafe { std::mem::transmute(n) };
            match s {
                BorderType::DashDot => StBorderStyle::DashDot,
                BorderType::DashDotDot => StBorderStyle::DashDotDot,
                BorderType::Dashed => StBorderStyle::Dashed,
                BorderType::Dotted => StBorderStyle::Dotted,
                BorderType::Double => StBorderStyle::Double,
                BorderType::Hair => StBorderStyle::Hair,
                BorderType::Medium => StBorderStyle::Medium,
                BorderType::MediumDashDot => StBorderStyle::MediumDashDot,
                BorderType::MediumDashDotDot => StBorderStyle::MediumDashDotDot,
                BorderType::MediumDashed => StBorderStyle::MediumDashed,
                BorderType::NoneBorder => StBorderStyle::None,
                BorderType::SlantDashDot => StBorderStyle::SlantDashDot,
                BorderType::Thick => StBorderStyle::Thick,
                BorderType::Thin => StBorderStyle::Thin,
            }
        }
    }

    impl PatternFill {
        pub fn from(fill: WbFill) -> Self {
            match fill {
                WbFill::PatternFill(pf) => {
                    let bg_color = convert_color(&pf.bg_color);
                    let fg_color = convert_color(&pf.fg_color);
                    let t: StPatternType = pf
                        .pattern_type
                        .as_ref()
                        .map_or(StPatternType::None, |a| a.clone());
                    let ty = PatternFillType::from(t);
                    PatternFill {
                        bg_color,
                        fg_color,
                        r#type: ty as i32,
                    }
                }
                WbFill::GradientFill(_) => PatternFill {
                    bg_color: String::from(""),
                    fg_color: String::from(""),
                    r#type: PatternFillType::NonePatternFill as i32,
                },
            }
        }

        pub fn into(self) -> WbFill {
            let bg_color = CtColor {
                auto: None,
                indexed: None,
                rgb: Some(self.bg_color),
                theme: None,
                tint: 0.0,
            };
            let fg_color = CtColor {
                auto: None,
                indexed: None,
                rgb: Some(self.fg_color),
                theme: None,
                tint: 0.0,
            };
            WbFill::PatternFill(WbPatternFill {
                fg_color: Some(fg_color),
                bg_color: Some(bg_color),
                pattern_type: Some(convert_pattern_type(self.r#type)),
            })
        }
    }

    impl PatternFillType {
        pub fn from(t: StPatternType) -> Self {
            match t {
                StPatternType::DarkDown => PatternFillType::DarkDown,
                StPatternType::DarkGray => PatternFillType::DarkGray,
                StPatternType::DarkGrid => PatternFillType::DarkGrid,
                StPatternType::DarkHorizontal => PatternFillType::DarkHorizontal,
                StPatternType::DarkTrellis => PatternFillType::DarkTrellis,
                StPatternType::DarkUp => PatternFillType::DarkUp,
                StPatternType::DarkVertical => PatternFillType::DarkVertical,
                StPatternType::Gray0625 => PatternFillType::Gray0625,
                StPatternType::Gray125 => PatternFillType::Gray125,
                StPatternType::LightDown => PatternFillType::LightDown,
                StPatternType::LightGray => PatternFillType::LightGray,
                StPatternType::LightGrid => PatternFillType::LightGrid,
                StPatternType::LightHorizontal => PatternFillType::LightHorizontal,
                StPatternType::LightTrellis => PatternFillType::LightTrellis,
                StPatternType::LightUp => PatternFillType::LightUp,
                StPatternType::LightVertical => PatternFillType::LightVertical,
                StPatternType::MediumGray => PatternFillType::MediumGray,
                StPatternType::None => PatternFillType::NonePatternFill,
                StPatternType::Solid => PatternFillType::Solid,
            }
        }
    }

    pub fn convert_pattern_type(i: i32) -> StPatternType {
        match i {
            0 => StPatternType::DarkDown,
            1 => StPatternType::DarkGray,
            2 => StPatternType::DarkGrid,
            3 => StPatternType::DarkHorizontal,
            4 => StPatternType::DarkTrellis,
            5 => StPatternType::DarkUp,
            6 => StPatternType::DarkVertical,
            7 => StPatternType::Gray0625,
            8 => StPatternType::Gray125,
            9 => StPatternType::LightDown,
            10 => StPatternType::LightGray,
            11 => StPatternType::LightGrid,
            12 => StPatternType::LightHorizontal,
            13 => StPatternType::LightTrellis,
            14 => StPatternType::LightUp,
            15 => StPatternType::LightVertical,
            16 => StPatternType::MediumGray,
            17 => StPatternType::None,
            18 => StPatternType::Solid,
            _ => StPatternType::None,
        }
    }

    impl ServerSend {
        pub fn from_action_effect(sheets: Vec<usize>, source: EventSource) -> Self {
            let su = SheetUpdated {
                index: sheets.into_iter().map(|i| i as u32).collect::<Vec<_>>(),
                event_source: Some(source),
            };
            ServerSend {
                server_send_oneof: Some(server_send::ServerSendOneof::SheetUpdated(su)),
            }
        }

        pub fn from_display_response(dr: DisplayResponse) -> Self {
            ServerSend {
                server_send_oneof: Some(server_send::ServerSendOneof::DisplayResponse(dr)),
            }
        }
    }

    fn convert_border_style(i: i32) -> StBorderStyle {
        match i {
            0 => StBorderStyle::DashDot,
            1 => StBorderStyle::DashDot,
            2 => StBorderStyle::Dashed,
            3 => StBorderStyle::Dotted,
            4 => StBorderStyle::Double,
            5 => StBorderStyle::Hair,
            6 => StBorderStyle::Medium,
            7 => StBorderStyle::MediumDashDot,
            8 => StBorderStyle::MediumDashDotDot,
            9 => StBorderStyle::MediumDashed,
            10 => StBorderStyle::None,
            11 => StBorderStyle::SlantDashDot,
            12 => StBorderStyle::Thick,
            13 => StBorderStyle::Thin,
            _ => unreachable!(),
        }
    }
}

pub fn deserialize_client_message(buf: Vec<u8>) -> Result<message::ClientSend, prost::DecodeError> {
    message::ClientSend::decode(&mut Cursor::new(buf))
}

pub fn serialize_client_message(m: message::ClientSend) -> Vec<u8> {
    let mut buf = Vec::with_capacity(m.encoded_len());
    m.encode(&mut buf).unwrap();
    buf
}

pub fn serialize_server_message(m: message::ServerSend) -> Vec<u8> {
    let mut buf = Vec::with_capacity(m.encoded_len());
    m.encode(&mut buf).unwrap();
    buf
}
