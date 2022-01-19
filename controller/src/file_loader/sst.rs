use std::collections::HashMap;

use controller_base::TextId;
use xlrs_workbook::shared_string_table::{SiRst, SstPart};

use crate::id_manager::TextIdManager;

pub struct SstSearcher {
    sst: SstPart,
    cache: HashMap<usize, TextId>,
}

impl SstSearcher {
    pub fn from(sst: SstPart) -> Self {
        SstSearcher {
            sst,
            cache: HashMap::new(),
        }
    }

    pub fn get_text_id(
        &mut self,
        idx: usize,
        text_id_manager: &mut TextIdManager,
    ) -> Option<TextId> {
        if let Some(id) = self.cache.get(&idx) {
            return Some(id.clone());
        }
        let si = self.sst.si.get(idx)?.clone();
        let s = sirst_to_plain_text(si);
        let id = text_id_manager.get_id(&s);
        self.cache.insert(idx, id);
        Some(id)
    }
}

fn sirst_to_plain_text(rst: SiRst) -> String {
    match rst.t {
        Some(p) => p.value,
        None => {
            let mut result = String::from("");
            rst.r.into_iter().for_each(|relt| {
                let s = relt.t.value;
                result.push_str(s.as_str());
            });
            result
        }
    }
}
