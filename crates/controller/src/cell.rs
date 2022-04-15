use controller_base::CellValue;
use controller_base::StyleId;

#[derive(Debug, Clone, Default)]
pub struct Cell {
    pub value: CellValue,
    pub style: StyleId,
}
