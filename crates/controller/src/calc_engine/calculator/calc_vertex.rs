use logisheets_base::cube_value::CubeValue;
use logisheets_base::matrix_value::MatrixValue;
use logisheets_base::Addr;
use logisheets_base::CellValue;
use logisheets_base::SheetId;
use logisheets_base::TextId;
use logisheets_parser::ast;

#[derive(Debug, Clone)]
pub enum CalcVertex {
    Value(CalcValue),
    Reference(CalcReference),
    Union(Vec<Box<CalcVertex>>), // comma operator
}

impl CalcVertex {
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
}

impl Default for Value {
    fn default() -> Self {
        Value::Blank
    }
}

impl Value {
    pub fn from_ast_value(v: &ast::Value) -> Self {
        match v {
            ast::Value::Blank => Value::Blank,
            ast::Value::Number(f) => Value::Number(f.clone()),
            ast::Value::Text(s) => Value::Text(s.clone()),
            ast::Value::Boolean(b) => Value::Boolean(b.clone()),
            ast::Value::Error(e) => Value::Error(e.clone()),
        }
    }

    pub fn from_cell_value<F>(v: CellValue, fetcher: &F) -> Self
    where
        F: Fn(&TextId) -> Option<String>,
    {
        match v {
            CellValue::Blank => Value::Blank,
            CellValue::Boolean(b) => Value::Boolean(b),
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
    Range(Addr, Addr),
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
