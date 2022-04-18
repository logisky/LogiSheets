use std::collections::{HashMap, HashSet};

use controller_base::async_func::{AsyncCalcResult, AsyncFuncCommitTrait, Task};
use controller_base::get_active_sheet::GetActiveSheetTrait;
use controller_base::get_curr_addr::GetCurrAddrTrait;
use controller_base::set_curr_cell::SetCurrCellTrait;
use controller_base::{
    matrix_value::{cross_product_usize, MatrixValue},
    Addr, CellId, CellValue, Error, FuncId, NameId, SheetId, TextId,
};
use parser::ast::{self, A1Reference, A1ReferenceRange, UnMutA1Reference, UnMutRefWithPrefix};

use crate::{
    async_func_manager::AsyncFuncManager,
    calc_engine::calculator::calc_vertex::{
        CalcReference, CalcValue, CalcVertex, ColRange, Reference, RowRange,
    },
    calc_engine::calculator::{
        calc_vertex::Value,
        infix::range::{get_range, get_range_without_prefix},
    },
    calc_engine::connector::Connector,
    cell::Cell,
    container::DataContainer,
    ext_book_manager::ExtBooksManager,
    id_manager::{FuncIdManager, TextIdManager},
    navigator::Navigator,
    vertex_manager::status::Status as VertexStatus,
    vertex_manager::vertex::FormulaId,
    workbook::sheet_pos_manager::SheetPosManager,
};

pub struct CalcConnector<'a> {
    pub vertex_status: &'a VertexStatus,
    pub navigator: &'a mut Navigator,
    pub container: &'a mut DataContainer,
    pub ext_links: &'a mut ExtBooksManager,
    pub text_id_manager: &'a mut TextIdManager,
    pub func_id_manager: &'a FuncIdManager,
    pub names_storage: HashMap<NameId, CalcValue>,
    pub cells_stroage: HashMap<FormulaId, CalcValue>,
    pub sheet_pos_manager: &'a SheetPosManager,
    pub async_func_manager: &'a mut AsyncFuncManager,
    pub async_funcs: &'a HashSet<String>,
    pub active_sheet: SheetId,
    pub curr_addr: Addr,
}

impl<'a> GetActiveSheetTrait for CalcConnector<'a> {
    fn get_active_sheet(&self) -> SheetId {
        self.active_sheet
    }
}

impl<'a> GetCurrAddrTrait for CalcConnector<'a> {
    fn get_curr_addr(&self) -> Addr {
        self.curr_addr
    }
}

impl<'a> SetCurrCellTrait for CalcConnector<'a> {
    fn set_curr_cell(&mut self, active_sheet: SheetId, addr: Addr) {
        self.active_sheet = active_sheet;
        self.curr_addr = addr;
    }
}

impl<'a> AsyncFuncCommitTrait for CalcConnector<'a> {
    fn query_or_commit_task(
        &mut self,
        sheet_id: SheetId,
        cell_id: CellId,
        task: Task,
    ) -> Option<AsyncCalcResult> {
        self.async_func_manager
            .query_or_commit(task, sheet_id, cell_id)
    }
}

impl<'a> Connector for CalcConnector<'a> {
    fn convert(&mut self, cr: &ast::CellReference) -> CalcVertex {
        match cr {
            ast::CellReference::Mut(mutref) => {
                let sheet_id = mutref.sheet_id;
                match &mutref.reference {
                    ast::MutRef::A1ReferenceRange(a1ref_range) => {
                        self.convert_a1ref_range(sheet_id, a1ref_range)
                    }
                    ast::MutRef::A1Reference(a1ref) => self.convert_a1ref(sheet_id, a1ref),
                }
            }
            ast::CellReference::UnMut(unmut_ref) => self.convert_unmut_ref(unmut_ref),
            ast::CellReference::Name(nid) => {
                if let Some(nf) = self.vertex_status.names.get(nid) {
                    match &nf.pure {
                        ast::PureNode::Reference(f) => self.convert(f),
                        _ => {
                            if let Some(v) = self.names_storage.get(nid) {
                                CalcVertex::Value(v.clone())
                            } else {
                                CalcVertex::from_error(ast::Error::Name)
                            }
                        }
                    }
                } else {
                    CalcVertex::from_error(ast::Error::Value)
                }
            }
        }
    }

    fn get_calc_value(&mut self, vertex: CalcVertex) -> CalcValue {
        match vertex {
            CalcVertex::Value(v) => v,
            CalcVertex::Union(union) => {
                let values = union
                    .into_iter()
                    .map(|arg| Box::new(self.get_calc_value(*arg)))
                    .collect::<Vec<_>>();
                CalcValue::Union(values)
            }
            CalcVertex::Reference(r) => {
                let sheet_id = r.sheet;
                match r.reference {
                    Reference::Addr(addr) => match r.from_sheet {
                        Some(from_sheet) => {
                            let sheets = self.get_sheet_ids(from_sheet, sheet_id);
                            sheets.into_iter().for_each(|s| {
                                let value = self.get_sheet_calc_range_value(
                                    s, addr.row, addr.col, addr.row, addr.col,
                                );
                            });
                            todo!()
                        }
                        None => self.get_sheet_calc_range_value(
                            sheet_id, addr.row, addr.col, addr.row, addr.col,
                        ),
                    },
                    Reference::ColumnRange(cr) => {
                        let start = cr.start;
                        let end = cr.end;
                        let v = self.get_matrix_between_cols(sheet_id, start, end);
                        CalcValue::Range(v)
                    }
                    Reference::RowRange(rr) => {
                        let start = rr.start;
                        let end = rr.end;
                        let v = self.get_matrix_between_rows(sheet_id, start, end);
                        CalcValue::Range(v)
                    }
                    Reference::Range(range) => {
                        let start = range.start;
                        let end = range.end;
                        match r.from_sheet {
                            Some(_) => todo!(),
                            None => self.get_sheet_calc_range_value(
                                sheet_id, start.row, start.col, end.row, end.col,
                            ),
                        }
                    }
                }
            }
        }
    }

    fn get_text(&self, tid: &TextId) -> Option<String> {
        self.text_id_manager.get_string(tid)
    }

    fn get_func_name(&self, fid: &FuncId) -> Option<String> {
        self.func_id_manager.get_string(fid)
    }

    fn get_cell_idx(
        &mut self,
        sheet_id: SheetId,
        cell_id: &controller_base::CellId,
    ) -> Option<(usize, usize)> {
        self.navigator.fetch_cell_idx(sheet_id, cell_id)
    }

    fn get_cell_id(&mut self, sheet_id: SheetId, row: usize, col: usize) -> Option<CellId> {
        self.navigator.fetch_cell_id(sheet_id, row, col)
    }

    fn commit_calc_values(&mut self, vertex: FormulaId, result: CalcValue) -> HashSet<FormulaId> {
        let dirties = HashSet::<FormulaId>::new();
        let sheet_id = vertex.0;
        let cell_id = vertex.1;
        let cell_idx = self.navigator.fetch_cell_idx(sheet_id, &cell_id).unwrap();
        match result {
            CalcValue::Scalar(v) => {
                let cell_value = value_to_cell_value(v, &mut |t| self.text_id_manager.get_id(&t));
                self.set_cell_value(sheet_id, cell_idx.0, cell_idx.1, cell_value);
                dirties
            }
            CalcValue::Range(_) => unreachable!(),
            CalcValue::Union(_) => {
                self.set_cell_value(
                    sheet_id,
                    cell_idx.0,
                    cell_idx.1,
                    CellValue::Error(Error::Value),
                );
                dirties
            }
            CalcValue::Cube(_) => unreachable!(),
        }
    }

    fn is_async_func(&self, func_name: &str) -> bool {
        self.async_funcs.get(func_name).is_some()
    }
}

impl<'a> CalcConnector<'a> {
    fn get_sheet_ids(&self, start: SheetId, end: SheetId) -> Vec<SheetId> {
        let start_idx = self.sheet_pos_manager.get_sheet_idx(start);
        let end_idx = self.sheet_pos_manager.get_sheet_idx(end);
        let mut result: Vec<SheetId> = Vec::new();
        match (start_idx, end_idx) {
            (Some(s_idx), Some(e_idx)) => {
                (s_idx..e_idx + 1).into_iter().for_each(|i| {
                    if let Some(id) = self.sheet_pos_manager.get_sheet_id(i) {
                        result.push(id)
                    }
                });
                result
            }
            _ => vec![],
        }
    }

    fn get_matrix_between_rows(
        &mut self,
        sheet_id: SheetId,
        row_start: usize,
        row_end: usize,
    ) -> MatrixValue<Value> {
        let sheet_container = self.container.data.get(&sheet_id);
        if sheet_container.is_none() {
            return MatrixValue::new(0, 0);
        }
        let sheet_container = sheet_container.unwrap().clone();
        // todo!() usize::MAX
        let mut matrix = MatrixValue::<Value>::new(row_end - row_start + 1, 65535);
        sheet_container.cells.iter().for_each(|(id, cell)| {
            let idx = self.navigator.fetch_cell_idx(sheet_id, id);
            if let Some((r, c)) = idx {
                if r >= row_start && r <= row_end {
                    let v = Value::from_cell_value(cell.value.clone(), &|t| {
                        self.text_id_manager.get_string(t)
                    });
                    matrix.insert(r - row_start, c, v);
                }
            }
        });
        matrix
    }

    fn get_matrix_between_cols(
        &mut self,
        sheet_id: SheetId,
        col_start: usize,
        col_end: usize,
    ) -> MatrixValue<Value> {
        let sheet_container = self.container.data.get(&sheet_id);
        if sheet_container.is_none() {
            return MatrixValue::new(0, 0);
        }
        let sheet_container = sheet_container.unwrap().clone();
        // todo!() usize::MAX
        let mut matrix = MatrixValue::<Value>::new(65535, col_end - col_start + 1);
        sheet_container.cells.iter().for_each(|(id, cell)| {
            let idx = self.navigator.fetch_cell_idx(sheet_id, id);
            if let Some((r, c)) = idx {
                if c >= col_start && c <= col_end {
                    let v = Value::from_cell_value(cell.value.clone(), &|t| {
                        self.text_id_manager.get_string(t)
                    });
                    matrix.insert(r, c - col_start, v);
                }
            }
        });
        matrix
    }

    fn get_sheet_calc_range_value(
        &mut self,
        sheet_id: SheetId,
        start_row: usize,
        start_col: usize,
        end_row: usize,
        end_col: usize,
    ) -> CalcValue {
        let pos = cross_product_usize(start_row, end_row, start_col, end_col);
        let values = pos
            .into_iter()
            .map(|(r_idx, c_idx)| {
                self.get_cell_value(sheet_id, r_idx, c_idx)
                    .unwrap_or(CellValue::Blank)
            })
            .collect::<Vec<_>>();
        if start_row == end_row && start_col == end_col {
            let cv = values.into_iter().next().unwrap();
            let value = Value::from_cell_value(cv, &|t| self.text_id_manager.get_string(t));
            CalcValue::Scalar(value)
        } else {
            let mut res: Vec<Vec<Value>> = Vec::with_capacity(end_row - start_row + 1);
            let mut values = values.into_iter();
            (start_row..end_row + 1).into_iter().for_each(|_| {
                let mut row = Vec::<Value>::new();
                (start_col..end_col + 1).into_iter().for_each(|_| {
                    let value = Value::from_cell_value(values.next().unwrap(), &|t| {
                        self.text_id_manager.get_string(t)
                    });
                    row.push(value);
                });
                res.push(row)
            });
            CalcValue::Range(MatrixValue::from(res))
        }
    }

    fn get_cell_value(
        &mut self,
        sheet_id: SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Option<CellValue> {
        let cid = self.navigator.fetch_cell_id(sheet_id, row_idx, col_idx)?;
        let sheet = self.container.get_sheet_container(sheet_id);
        let cell = sheet.cells.get(&cid)?;
        let value = cell.value.clone();
        Some(value)
    }

    fn set_cell_value(
        &mut self,
        sheet_id: SheetId,
        row_idx: usize,
        col_idx: usize,
        value: CellValue,
    ) {
        if let Some(cid) = self.navigator.fetch_cell_id(sheet_id, row_idx, col_idx) {
            let sheet = self.container.get_sheet_container(sheet_id);
            if let Some(c) = sheet.cells.get_mut(&cid) {
                c.value = value
            } else {
                let mut cell = Cell::default();
                cell.value = value;
                self.container.add_cell(sheet_id, cid, cell)
            }
        }
    }

    fn convert_a1ref_range(
        &mut self,
        sheet_id: SheetId,
        a1ref_range: &A1ReferenceRange,
    ) -> CalcVertex {
        let start = self.convert_a1ref(sheet_id, &a1ref_range.start);
        let end = self.convert_a1ref(sheet_id, &a1ref_range.end);
        get_range(start, end)
    }

    fn convert_a1ref(&mut self, sheet_id: SheetId, a1ref: &A1Reference) -> CalcVertex {
        match a1ref {
            ast::A1Reference::A1ColumnRange(cr) => {
                let start_idx = self.navigator.fetch_col_idx(sheet_id, cr.start);
                let end_idx = self.navigator.fetch_col_idx(sheet_id, cr.end);
                match (start_idx, end_idx) {
                    (Some(s), Some(e)) => CalcVertex::Reference(CalcReference {
                        from_sheet: None,
                        sheet: sheet_id,
                        reference: Reference::ColumnRange(ColRange { start: s, end: e }),
                    }),
                    _ => CalcVertex::from_error(ast::Error::Name),
                }
            }
            ast::A1Reference::A1RowRange(rr) => {
                let start_idx = self.navigator.fetch_row_idx(sheet_id, rr.start);
                let end_idx = self.navigator.fetch_row_idx(sheet_id, rr.end);
                match (start_idx, end_idx) {
                    (Some(s), Some(e)) => CalcVertex::Reference(CalcReference {
                        from_sheet: None,
                        sheet: sheet_id,
                        reference: Reference::RowRange(RowRange { start: s, end: e }),
                    }),
                    _ => CalcVertex::from_error(ast::Error::Name),
                }
            }
            ast::A1Reference::Addr(addr) => {
                let cell_id = &addr.cell_id;
                let idx = self.navigator.fetch_cell_idx(sheet_id, cell_id);
                match idx {
                    Some((row, col)) => CalcVertex::Reference(CalcReference {
                        from_sheet: None,
                        sheet: sheet_id,
                        reference: Reference::Addr(Addr { row, col }),
                    }),
                    None => CalcVertex::from_error(ast::Error::Name),
                }
            }
        }
    }

    pub fn convert_unmut_ref(&mut self, unmut_ref: &UnMutRefWithPrefix) -> CalcVertex {
        let prefix = &unmut_ref.prefix;
        let reference = &unmut_ref.reference;
        match (prefix, reference) {
            (ast::UnMutRefPrefix::Local(lp), ast::UnMutRef::A1ReferenceRange(r)) => {
                let start = unmut_ref_to_reference(&r.start);
                let end = unmut_ref_to_reference(&r.end);
                if let Some(result) = get_range_without_prefix(start, end) {
                    match lp {
                        ast::LocalUnMutRefPrefix::SheetToSheet(sts) => {
                            CalcVertex::Reference(CalcReference {
                                from_sheet: Some(sts.from_sheet),
                                sheet: sts.to_sheet,
                                reference: result,
                            })
                        }
                    }
                } else {
                    CalcVertex::from_error(ast::Error::Value)
                }
            }
            (ast::UnMutRefPrefix::Local(lp), ast::UnMutRef::A1Reference(a1ref)) => {
                let r = match (a1ref, lp) {
                    (
                        ast::UnMutA1Reference::A1ColumnRange(cr),
                        ast::LocalUnMutRefPrefix::SheetToSheet(sts),
                    ) => CalcReference {
                        from_sheet: Some(sts.from_sheet),
                        sheet: sts.to_sheet,
                        reference: Reference::ColumnRange(ColRange {
                            start: cr.start,
                            end: cr.end,
                        }),
                    },
                    (
                        ast::UnMutA1Reference::A1RowRange(rr),
                        ast::LocalUnMutRefPrefix::SheetToSheet(sts),
                    ) => CalcReference {
                        from_sheet: Some(sts.from_sheet),
                        sheet: sts.to_sheet,
                        reference: Reference::RowRange(RowRange {
                            start: rr.start,
                            end: rr.end,
                        }),
                    },
                    (
                        ast::UnMutA1Reference::Addr(addr),
                        ast::LocalUnMutRefPrefix::SheetToSheet(sts),
                    ) => CalcReference {
                        from_sheet: Some(sts.from_sheet),
                        sheet: sts.to_sheet,
                        reference: Reference::Addr(Addr {
                            row: addr.row,
                            col: addr.col,
                        }),
                    },
                };
                CalcVertex::Reference(r)
            }
            (ast::UnMutRefPrefix::External(ext), ast::UnMutRef::A1ReferenceRange(a1ref_range)) => {
                match ext {
                    ast::ExternalUnMutRefPrefix::Sheet(ext_sheet) => {
                        let ext_book_id = ext_sheet.workbook;
                        let sheet_id = ext_sheet.sheet;
                        let v = match (&a1ref_range.start, &a1ref_range.end) {
                            (UnMutA1Reference::Addr(start), UnMutA1Reference::Addr(end)) => {
                                self.ext_links.get_addr_range_value(
                                    ext_book_id,
                                    None,
                                    sheet_id,
                                    Addr {
                                        row: start.row,
                                        col: start.col,
                                    },
                                    Addr {
                                        row: end.row,
                                        col: end.col,
                                    },
                                )
                            }
                            _ => unimplemented!(),
                        };
                        CalcVertex::Value(v)
                    }
                    ast::ExternalUnMutRefPrefix::SheetToSheet(_) => todo!(),
                }
            }
            (ast::UnMutRefPrefix::External(ext), ast::UnMutRef::A1Reference(a1ref)) => match ext {
                ast::ExternalUnMutRefPrefix::Sheet(ext_sheet) => {
                    let ext_book_id = ext_sheet.workbook;
                    let sheet_id = ext_sheet.sheet;
                    let v =
                        match a1ref {
                            UnMutA1Reference::A1ColumnRange(cr) => self
                                .ext_links
                                .get_col_range_value(ext_book_id, None, sheet_id, cr.start, cr.end),
                            UnMutA1Reference::A1RowRange(rr) => self.ext_links.get_row_range_value(
                                ext_book_id,
                                None,
                                sheet_id,
                                rr.start,
                                rr.end,
                            ),
                            UnMutA1Reference::Addr(addr) => self.ext_links.get_addr_value(
                                ext_book_id,
                                sheet_id,
                                Addr {
                                    row: addr.row,
                                    col: addr.col,
                                },
                            ),
                        };
                    CalcVertex::Value(v)
                }
                ast::ExternalUnMutRefPrefix::SheetToSheet(_) => todo!(),
            },
        }
    }
}

fn unmut_ref_to_reference(r: &UnMutA1Reference) -> Reference {
    match r {
        UnMutA1Reference::A1ColumnRange(cr) => Reference::ColumnRange(ColRange {
            start: cr.start,
            end: cr.end,
        }),
        UnMutA1Reference::A1RowRange(rr) => Reference::RowRange(RowRange {
            start: rr.start,
            end: rr.end,
        }),
        UnMutA1Reference::Addr(addr) => Reference::Addr(Addr {
            row: addr.row,
            col: addr.col,
        }),
    }
}

fn value_to_cell_value<F>(value: Value, text_converter: &mut F) -> CellValue
where
    F: FnMut(String) -> TextId,
{
    match value {
        Value::Blank => CellValue::Blank,
        Value::Number(f) => CellValue::Number(f),
        Value::Text(text) => CellValue::String(text_converter(text)),
        Value::Boolean(b) => CellValue::Boolean(b),
        Value::Error(e) => match e {
            ast::Error::Unspecified => CellValue::Error(Error::Unspecified),
            ast::Error::Div0 => CellValue::Error(Error::Div0),
            ast::Error::Na => CellValue::Error(Error::NA),
            ast::Error::Name => CellValue::Error(Error::Name),
            ast::Error::Null => CellValue::Error(Error::Null),
            ast::Error::Num => CellValue::Error(Error::Num),
            ast::Error::Ref => CellValue::Error(Error::Ref),
            ast::Error::Value => CellValue::Error(Error::Value),
            ast::Error::GettingData => CellValue::Error(Error::GettingData),
        },
        Value::Date(d) => CellValue::Date(d),
    }
}
