use itertools::Itertools;
use logisheets_workbook::prelude::{CtRst, SstPart};

use crate::id_manager::TextIdManager;

use super::utils::convert_string_to_plain_text_string;

pub fn save_sst(text_id_manager: &TextIdManager) -> Option<SstPart> {
    let si = text_id_manager
        .get_all_ids()
        .into_iter()
        .sorted()
        .map(|id| {
            let raw_string = text_id_manager.get_string(&id);
            let t = if raw_string.is_none() {
                None
            } else {
                let s = raw_string.unwrap();
                Some(convert_string_to_plain_text_string(s))
            };
            CtRst {
                t,
                r: vec![],
                r_ph: vec![],
                phonetic_pr: None,
            }
        })
        .collect::<Vec<_>>();
    if si.is_empty() {
        None
    } else {
        Some(SstPart {
            count: None,
            unique_count: None,
            si,
        })
    }
}
