use im::hashmap::HashMap;
use serde::Serialize;
use xlrs_workbook::complex_types::BooleanProperty;

pub fn build_boolean_property(val: bool) -> BooleanProperty {
    BooleanProperty { val }
}

#[derive(Debug, Clone)]
struct KeyValue<K, V>
where
    K: Serialize + Clone,
    V: Clone,
{
    pub key: K,
    pub value: V,
}

#[derive(Debug, Clone, Default)]
pub struct OoxmlElementMap<K: Serialize, V>
where
    K: Serialize + Clone,
    V: Clone,
{
    core: HashMap<String, KeyValue<K, V>>,
}

impl<K: Serialize, V> OoxmlElementMap<K, V>
where
    K: Serialize + Clone,
    V: Clone,
{
    pub fn insert(&mut self, key: K, value: V) {
        let s = quick_xml::se::to_string(&key).unwrap();
        let key_value = KeyValue { key, value };
        self.core.insert(s, key_value);
    }

    pub fn get(&self, key: &K) -> Option<&V> {
        let s = quick_xml::se::to_string(&key).unwrap();
        let key_value = self.core.get(&s)?;
        Some(&key_value.value)
    }

    pub fn new() -> Self {
        OoxmlElementMap {
            core: HashMap::new(),
        }
    }
}
