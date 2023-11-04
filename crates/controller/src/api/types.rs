#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "save_file_result.ts")
)]
pub struct SaveFileResult {
    pub data: Vec<u8>,
    pub code: u8,
}
