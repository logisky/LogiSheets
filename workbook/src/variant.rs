use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename = "vt:variant")]
pub enum Variant {
    #[serde(rename = "vt:vector")]
    VtVector {
        size: usize,
        #[serde(rename = "baseType")]
        base_type: String,
        #[serde(rename = "$value")]
        variants: Vec<Variant>,
    },
    #[serde(rename = "vt:variant")]
    VtVariant {
        #[serde(rename = "$value")]
        value: Box<Variant>,
    },
    // //VTArray(Vec<impl Any>),
    // //VTBlob(&[u8]),
    // VTEmpty,
    #[serde(rename = "vt:null")]
    VtNull,
    // VTByte(u8),
    // VTShort(i16),
    // VTInt32(i32),
    // //#[serde(rename = "vt:int64")]
    // VTInt64(i64),
    #[serde(rename = "vt:i1")]
    VtI1(i8),
    #[serde(rename = "vt:i2")]
    VtI2(i8),
    #[serde(rename = "vt:i4")]
    VtI4(i8),
    #[serde(rename = "vt:i8")]
    VtI8(i8),
    #[serde(rename = "vt:lpstr")]
    VtLpstr(String),
    #[serde(rename = "vt:lpwstr")]
    VtLpwstr(String),
}
