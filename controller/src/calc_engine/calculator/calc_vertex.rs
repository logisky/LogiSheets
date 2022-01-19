use chrono::DateTime;
use chrono::FixedOffset;
use controller_base::cube_value::CubeValue;
use controller_base::matrix_value::MatrixValue;
use controller_base::Addr;
use controller_base::CellValue;
use controller_base::SheetId;
use controller_base::TextId;
use parser::ast;

#[derive(Debug, Clone)]
pub enum CalcVertex {
    Value(CalcValue),
    Reference(CalcReference),
    Union(Vec<Box<CalcVertex>>), // comma operator
}

impl CalcVertex {
    pub fn get_sheet_id(&self) -> Option<SheetId> {
        match self {
            CalcVertex::Value(_) => None,
            CalcVertex::Reference(r) => Some(r.sheet),
            CalcVertex::Union(u) => {
                let sheet_id = u.get(0)?.as_ref().get_sheet_id()?;
                Some(sheet_id)
            }
        }
    }

    pub fn get_addr(&self) -> Option<Addr> {
        match self {
            CalcVertex::Value(_) => None,
            CalcVertex::Reference(r) => match &r.reference {
                Reference::Addr(addr) => Some(*addr),
                Reference::ColumnRange(cr) => Some(Addr {
                    row: 0,
                    col: cr.start,
                }),
                Reference::RowRange(rr) => Some(Addr {
                    row: rr.start,
                    col: 0,
                }),
                Reference::Range(range) => Some(range.start),
            },
            CalcVertex::Union(u) => {
                let addr = u.get(0)?.as_ref().get_addr()?;
                Some(addr)
            }
        }
    }

    pub fn from_error(e: ast::Error) -> Self {
        CalcVertex::Value(CalcValue::Scalar(Value::Error(e)))
    }

    pub fn from_number(n: f64) -> Self {
        CalcVertex::Value(CalcValue::Scalar(Value::Number(n)))
    }

    pub fn from_string(s: String) -> Self {
        CalcVertex::Value(CalcValue::Scalar(Value::Text(s)))
    }

    pub fn from_bool(b: bool) -> Self {
        CalcVertex::Value(CalcValue::Scalar(Value::Boolean(b)))
    }

    pub fn from_text(t: String) -> Self {
        CalcVertex::Value(CalcValue::Scalar(Value::Text(t)))
    }
}

#[derive(Debug, Clone)]
pub enum CalcValue {
    Scalar(Value),
    Range(MatrixValue<Value>),
    Cube(CubeValue<Value>),
    Union(Vec<Box<CalcValue>>), // comma operator
}

impl CalcValue {
    pub fn to_async_arg(self) -> String {
        match self {
            CalcValue::Scalar(v) => match v {
                Value::Blank => String::from(""),
                Value::Number(n) => n.to_string(),
                Value::Text(t) => t,
                Value::Boolean(b) => {
                    if b {
                        String::from("TRUE")
                    } else {
                        String::from("FALSE")
                    }
                }
                Value::Error(e) => e.get_err_str().to_string(),
                Value::Date(_) => todo!(),
            },
            CalcValue::Range(_) => todo!(),
            CalcValue::Cube(_) => todo!(),
            CalcValue::Union(_) => todo!(),
        }
    }
}

#[derive(Debug, Clone)]
pub enum Value {
    Blank,
    Number(f64),
    Text(String),
    Boolean(bool),
    Error(ast::Error),
    Date(DateTime<FixedOffset>),
}

impl Default for Value {
    fn default() -> Self {
        Value::Blank
    }
}

impl Value {
    pub fn from_ast_value<F>(v: &ast::Value, fetcher: &F) -> Self
    where
        F: Fn(&TextId) -> Option<String>,
    {
        match v {
            ast::Value::Blank => Value::Blank,
            ast::Value::Number(f) => Value::Number(f.clone()),
            ast::Value::Text(id) => Value::Text(fetcher(id).unwrap_or(String::from(""))),
            ast::Value::Boolean(b) => Value::Boolean(b.clone()),
            ast::Value::Error(e) => Value::Error(e.clone()),
            ast::Value::Date(d) => Value::Date(d.clone()),
        }
    }

    pub fn from_cell_value<F>(v: CellValue, fetcher: &F) -> Self
    where
        F: Fn(&TextId) -> Option<String>,
    {
        match v {
            CellValue::Blank => Value::Blank,
            CellValue::Boolean(b) => Value::Boolean(b),
            CellValue::Date(_) => todo!(),
            CellValue::Error(e) => Value::Error(ast::Error::from_err_str(&e.to_string())),
            CellValue::String(tid) => Value::Text(fetcher(&tid).unwrap_or(String::from(""))),
            CellValue::Number(f) => Value::Number(f),
            CellValue::InlineStr(_) => todo!(),
            CellValue::FormulaStr(s) => Value::Text(s),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CalcReference {
    pub from_sheet: Option<SheetId>,
    pub sheet: SheetId,
    pub reference: Reference,
}

#[derive(Debug, Clone)]
pub enum Reference {
    Addr(Addr),
    ColumnRange(ColRange),
    RowRange(RowRange),
    Range(Range),
}

#[derive(Debug, Clone)]
pub struct ColRange {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone)]
pub struct RowRange {
    pub start: usize,
    pub end: usize,
}
#[derive(Debug, Clone)]
pub struct Range {
    pub start: Addr,
    pub end: Addr,
}
