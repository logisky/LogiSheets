pub fn serialize_bool<S>(t: &bool, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    match *t {
        true => serializer.serialize_u8(1),
        false => serializer.serialize_u8(0),
    }
}

pub fn serialize_option_bool<S>(t: &Option<bool>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    match t {
        Some(b) => serialize_bool(b, serializer),
        None => serializer.serialize_none(),
    }
}

pub fn default_zero_string() -> String {
    String::from("0")
}

pub fn is_default_zero_string(t: &String) -> bool {
    t == "0"
}

pub fn default_as_true() -> bool {
    true
}

pub fn default_as_false() -> bool {
    false
}

pub fn default_zero() -> u32 {
    0
}

pub fn default_zero_f64() -> f64 {
    0.0
}

pub fn default_one() -> u32 {
    1
}

pub fn default_zoom_scale() -> u32 {
    100
}

pub fn default_scale() -> u32 {
    100
}

pub fn default_dpi() -> u32 {
    600
}

pub fn is_default_dpi(t: &u32) -> bool {
    *t == 600
}

pub fn is_default_scale(t: &u32) -> bool {
    *t == 100
}

pub fn is_default_zoom_scale(t: &u32) -> bool {
    *t == 100
}

pub fn is_default_zero(t: &u32) -> bool {
    *t == 0_u32
}

pub fn is_default_one(t: &u32) -> bool {
    *t == 1_u32
}

pub fn is_default_zero_f64(t: &f64) -> bool {
    *t == 0_f64
}

pub fn is_default_false(t: &bool) -> bool {
    *t == false
}

pub fn is_default_true(t: &bool) -> bool {
    *t == true
}
