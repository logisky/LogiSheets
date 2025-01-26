use std::collections::{HashMap, HashSet};

use logisheets_base::async_func::{AsyncCalcResult, AsyncFuncCommitTrait, Task};
use logisheets_base::errors::BasicError;
use logisheets_base::get_curr_addr::GetCurrAddrTrait;
use logisheets_base::set_curr_cell::SetCurrCellTrait;
use logisheets_base::{
    matrix_value::{cross_product_usize, MatrixValue},
    Addr, CellId, CellValue, Error, FuncId, NameId, SheetId, TextId,
};
use logisheets_base::{BlockRange, CubeCross, NormalRange, Range};
use logisheets_parser::ast;

use crate::cube_manager::CubeManager;
use crate::id_manager::SheetIdManager;
use crate::range_manager::RangeManager;
use crate::{
    async_func_manager::AsyncFuncManager,
    calc_engine::calculator::calc_vertex::Value,
    calc_engine::calculator::calc_vertex::{
        CalcReference, CalcValue, CalcVertex, ColRange, Reference, RowRange,
    },
    calc_engine::connector::Connector,
    cell::Cell,
    container::DataContainer,
    ext_book_manager::ExtBooksManager,
    id_manager::{FuncIdManager, TextIdManager},
    navigator::Navigator,
    workbook::sheet_pos_manager::SheetPosManager,
};

use crate::errors::Result;

#[allow(unused)]
pub struct CalcConnector<'a> {
    pub range_manager: &'a RangeManager,
    pub cube_manager: &'a CubeManager,
    pub navigator: &'a mut Navigator,
    pub container: &'a mut DataContainer,
    pub ext_links: &'a mut ExtBooksManager,
    pub text_id_manager: &'a mut TextIdManager,
    pub func_id_manager: &'a FuncIdManager,
    pub sheet_id_manager: &'a SheetIdManager,
    pub names_storage: HashMap<NameId, CalcValue>,
    pub cells_stroage: HashMap<(SheetId, CellId), CalcValue>,
    pub sheet_pos_manager: &'a SheetPosManager,
    pub async_func_manager: &'a mut AsyncFuncManager,
    pub async_funcs: &'a HashSet<String>,
    pub active_sheet: SheetId,
    pub curr_addr: Addr,

    pub dirty_cells_in_next_run: &'a mut im::HashSet<(SheetId, CellId)>,
    pub calc_cells: &'a mut HashSet<(SheetId, CellId)>,
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
            .query_or_commit_task(task, sheet_id, cell_id)
    }
}

impl<'a> Connector for CalcConnector<'a> {
    fn convert(&mut self, cr: &ast::CellReference) -> CalcVertex {
        match cr {
            ast::CellReference::Mut(range_display) => {
                let sheet_id = range_display.sheet_id;
                let range_id = range_display.range_id;
                let range = self.range_manager.get_range(&sheet_id, &range_id);
                match range {
                    Some(range) => match range {
                        Range::Normal(nomral_range) => match nomral_range {
                            NormalRange::Single(normal_cell_id) => {
                                let (row, col) = self
                                    .navigator
                                    .fetch_normal_cell_idx(&sheet_id, &normal_cell_id)
                                    .unwrap();
                                CalcVertex::Reference(CalcReference {
                                    from_sheet: None,
                                    sheet: sheet_id,
                                    reference: Reference::Addr(Addr { row, col }),
                                })
                            }
                            NormalRange::RowRange(start_id, end_id) => {
                                let start =
                                    self.navigator.fetch_row_idx(&sheet_id, &start_id).unwrap();
                                let end = self.navigator.fetch_row_idx(&sheet_id, &end_id).unwrap();
                                CalcVertex::Reference(CalcReference {
                                    from_sheet: None,
                                    sheet: sheet_id,
                                    reference: Reference::RowRange(RowRange { start, end }),
                                })
                            }
                            NormalRange::ColRange(start_id, end_id) => {
                                let start =
                                    self.navigator.fetch_col_idx(&sheet_id, &start_id).unwrap();
                                let end = self.navigator.fetch_col_idx(&sheet_id, &end_id).unwrap();
                                CalcVertex::Reference(CalcReference {
                                    from_sheet: None,
                                    sheet: sheet_id,
                                    reference: Reference::ColumnRange(ColRange { start, end }),
                                })
                            }
                            NormalRange::AddrRange(start, end) => {
                                let (start_row, start_col) = self
                                    .navigator
                                    .fetch_normal_cell_idx(&sheet_id, &start)
                                    .unwrap();
                                let (end_row, end_col) = self
                                    .navigator
                                    .fetch_normal_cell_idx(&sheet_id, &end)
                                    .unwrap();
                                CalcVertex::Reference(CalcReference {
                                    from_sheet: None,
                                    sheet: sheet_id,
                                    reference: Reference::Range(
                                        Addr {
                                            row: start_row,
                                            col: start_col,
                                        },
                                        Addr {
                                            row: end_row,
                                            col: end_col,
                                        },
                                    ),
                                })
                            }
                        },
                        Range::Block(block_range) => match block_range {
                            BlockRange::Single(block_cell_id) => {
                                let (row, col) = self
                                    .navigator
                                    .fetch_cell_idx(&sheet_id, &CellId::BlockCell(block_cell_id))
                                    .unwrap();
                                CalcVertex::Reference(CalcReference {
                                    from_sheet: None,
                                    sheet: sheet_id,
                                    reference: Reference::Addr(Addr { row, col }),
                                })
                            }
                            BlockRange::AddrRange(start, end) => {
                                let (start_row, start_col) = self
                                    .navigator
                                    .fetch_cell_idx(&sheet_id, &CellId::BlockCell(start))
                                    .unwrap();
                                let (end_row, end_col) = self
                                    .navigator
                                    .fetch_cell_idx(&sheet_id, &CellId::BlockCell(end))
                                    .unwrap();
                                CalcVertex::Reference(CalcReference {
                                    from_sheet: None,
                                    sheet: sheet_id,
                                    reference: Reference::Range(
                                        Addr {
                                            row: start_row,
                                            col: start_col,
                                        },
                                        Addr {
                                            row: end_row,
                                            col: end_col,
                                        },
                                    ),
                                })
                            }
                        },
                    },
                    None => panic!("can not find the range id"),
                }
            }
            ast::CellReference::UnMut(cube) => {
                let cube_id = cube.cube_id;
                let cube = self.cube_manager.get_cube(&cube_id).unwrap();
                match cube.cross {
                    CubeCross::Single(row, col) => CalcVertex::Reference(CalcReference {
                        from_sheet: Some(cube.from_sheet),
                        sheet: cube.to_sheet,
                        reference: Reference::Addr(Addr { row, col }),
                    }),
                    CubeCross::RowRange(start, end) => CalcVertex::Reference(CalcReference {
                        from_sheet: Some(cube.from_sheet),
                        sheet: cube.to_sheet,
                        reference: Reference::RowRange(RowRange { start, end }),
                    }),
                    CubeCross::ColRange(start, end) => CalcVertex::Reference(CalcReference {
                        from_sheet: Some(cube.from_sheet),
                        sheet: cube.to_sheet,
                        reference: Reference::ColumnRange(ColRange { start, end }),
                    }),
                    CubeCross::AddrRange(start, end) => CalcVertex::Reference(CalcReference {
                        from_sheet: Some(cube.from_sheet),
                        sheet: cube.to_sheet,
                        reference: Reference::Range(
                            Addr {
                                row: start.row,
                                col: start.col,
                            },
                            Addr {
                                row: end.row,
                                col: end.col,
                            },
                        ),
                    }),
                }
            }
            ast::CellReference::Ext(_) => todo!(),
            ast::CellReference::Name(_) => todo!(),
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
                                let _value = self.get_sheet_calc_range_value(
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
                    Reference::Range(start, end) => match r.from_sheet {
                        Some(_) => todo!(),
                        None => self.get_sheet_calc_range_value(
                            sheet_id, start.row, start.col, end.row, end.col,
                        ),
                    },
                }
            }
        }
    }

    #[inline]
    fn get_text(&self, tid: &TextId) -> Result<String> {
        self.text_id_manager
            .get_string(tid)
            .ok_or(BasicError::TextIdNotFound(*tid).into())
    }

    #[inline]
    fn get_func_name(&self, fid: &FuncId) -> Result<String> {
        self.func_id_manager
            .get_string(fid)
            .ok_or(BasicError::FuncIdNotFound(*fid).into())
    }

    fn get_cell_idx(
        &self,
        sheet_id: SheetId,
        cell_id: &logisheets_base::CellId,
    ) -> Result<(usize, usize)> {
        self.navigator
            .fetch_cell_idx(&sheet_id, cell_id)
            .map_err(|e| e.into())
    }

    #[inline]
    fn get_cell_id(&self, sheet_id: SheetId, row: usize, col: usize) -> Result<CellId> {
        self.navigator
            .fetch_cell_id(&sheet_id, row, col)
            .map_err(|e| e.into())
    }

    fn commit_calc_values(&mut self, vertex: (SheetId, CellId), result: CalcValue) {
        self.calc_cells.insert(vertex);

        let sheet_id = vertex.0;
        let cell_id = vertex.1;
        match result {
            CalcValue::Scalar(v) => {
                let cell_value =
                    value_to_cell_value(v, &mut |t| self.text_id_manager.get_or_register_id(&t));
                self.set_cell_value(sheet_id, cell_id, cell_value);
            }
            CalcValue::Range(_) => unreachable!(),
            CalcValue::Union(_) => {
                self.set_cell_value(sheet_id, cell_id, CellValue::Error(Error::Value));
            }
            CalcValue::Cube(_) => unreachable!(),
        }
    }

    fn is_async_func(&self, func_name: &str) -> bool {
        self.async_funcs.get(func_name).is_some()
    }

    fn get_range(&self, sheet_id: &SheetId, range: &u32) -> Option<Range> {
        self.range_manager.get_range(sheet_id, range)
    }

    fn get_sheet_id_by_name(&self, name: &str) -> Result<SheetId> {
        let id = self.sheet_id_manager.get_id(name);
        match id {
            Some(id) => Ok(*id),
            None => Err(BasicError::SheetNameNotFound(name.to_string()).into()),
        }
    }

    fn set_curr_as_dirty(&mut self) -> Result<()> {
        let Addr { row, col } = self.get_curr_addr();
        let sheet_id = self.get_active_sheet();
        let cell_id = self.get_cell_id(sheet_id, row, col)?;
        self.dirty_cells_in_next_run.insert((sheet_id, cell_id));
        Ok(())
    }

    fn get_active_sheet(&self) -> SheetId {
        self.active_sheet
    }
}

impl<'a> CalcConnector<'a> {
    fn get_sheet_ids(&self, start: SheetId, end: SheetId) -> Vec<SheetId> {
        let start_idx = self.sheet_pos_manager.get_sheet_idx(&start);
        let end_idx = self.sheet_pos_manager.get_sheet_idx(&end);
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
            let idx = self.navigator.fetch_cell_idx(&sheet_id, id);
            if let Ok((r, c)) = idx {
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
            let idx = self.navigator.fetch_cell_idx(&sheet_id, id);
            if let Ok((r, c)) = idx {
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
    ) -> Result<CellValue> {
        let cid = self.navigator.fetch_cell_id(&sheet_id, row_idx, col_idx)?;
        let sheet = self.container.get_sheet_container_mut(sheet_id);
        if let Some(cell) = sheet.cells.get(&cid) {
            let value = cell.value.clone();
            Ok(value)
        } else {
            Ok(CellValue::Blank)
        }
    }

    fn set_cell_value(&mut self, sheet_id: SheetId, cell_id: CellId, value: CellValue) {
        let sheet = self.container.get_sheet_container_mut(sheet_id);
        if let Some(c) = sheet.cells.get_mut(&cell_id) {
            c.value = value
        } else {
            let mut cell = Cell::default();
            cell.value = value;
            self.container.add_cell(sheet_id, cell_id, cell)
        }
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
    }
}
