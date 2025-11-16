use xmlserde_derives::{XmlDeserialize, XmlSerialize};

/// Stores the LogiSheets-specific data.
///
/// LogiSheetsData is the root element of the logisheets.xml file.
/// This is exclusive to LogiSheets and is not part of the OpenXML standard.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(root = b"logisheets")]
pub struct LogiSheetsData {
    /// LogiSheets builting sheet data.
    #[xmlserde(name = b"sheet", ty = "child")]
    pub sheets: Vec<Sheet>,
    /// LogiSheets app data.
    ///
    /// When calling the save function, the application will provide
    /// their app-specific data and they are stored in this element.
    ///
    /// When calling the load function, these data will be given to
    /// the application and it is up to the application to parse them.
    #[xmlserde(name = b"app", ty = "child")]
    pub apps: Vec<AppData>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct BlockRange {
    #[xmlserde(name = b"startRow", ty = "attr")]
    pub start_row: usize,
    #[xmlserde(name = b"startCol", ty = "attr")]
    pub start_col: usize,
    #[xmlserde(name = b"rowCnt", ty = "attr")]
    pub row_cnt: usize,
    #[xmlserde(name = b"colCnt", ty = "attr")]
    pub col_cnt: usize,
    #[xmlserde(name = b"rowInfos", ty = "child")]
    pub row_infos: Vec<BlockLineInfo>,
    #[xmlserde(name = b"colInfos", ty = "child")]
    pub col_infos: Vec<BlockLineInfo>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct BlockLineInfo {
    #[xmlserde(name = b"style", ty = "attr")]
    pub style: Option<u32>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"fieldId", ty = "attr")]
    pub field_id: String,
    #[xmlserde(name = b"diyRender", ty = "attr")]
    pub diy_render: Option<bool>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CellAppendix {
    #[xmlserde(name = b"rowIdx", ty = "attr")]
    pub row_idx: u32,
    #[xmlserde(name = b"colIdx", ty = "attr")]
    pub col_idx: u32,
    #[xmlserde(name = b"craftId", ty = "attr")]
    pub craft_id: String,
    #[xmlserde(name = b"content", ty = "text")]
    pub content: String,
    #[xmlserde(name = b"craftTag", ty = "attr")]
    pub craft_tag: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct Sheet {
    #[xmlserde(name = b"blockRange", ty = "child")]
    pub block_ranges: Vec<BlockRange>,
    #[xmlserde(name = b"cellAppendix", ty = "child")]
    pub cell_appendices: Vec<CellAppendix>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct AppData {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"data", ty = "text")]
    pub data: String,
}
