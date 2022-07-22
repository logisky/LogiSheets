use proc_macro2::Ident;
use syn::Attribute;
use syn::Meta::List;
use syn::Meta::NameValue;
use syn::NestedMeta::Meta;
use syn::Type;

use crate::symbol::FILE_NAME;
use crate::symbol::{RENAME, RENAME_ALL, SKIP, TS};

pub struct Contianer<'a> {
    pub file_name: String,
    pub is_enum: bool,
    pub fields: Vec<Field<'a>>,
    pub rename_all: Option<RenameAll>,
    pub rename: Option<String>,
    pub ident: &'a Ident,
}

impl<'a> Contianer<'a> {
    pub fn from_ast(item: &'a syn::DeriveInput) -> Self {
        let mut rename_all: Option<RenameAll> = None;
        let mut file_name: Option<String> = None;
        let mut rename: Option<String> = None;
        for meta_item in item
            .attrs
            .iter()
            .flat_map(|attr| get_ts_meta_items(attr))
            .flatten()
        {
            match meta_item {
                Meta(NameValue(m)) if m.path == RENAME_ALL => {
                    let s = get_lit_str(&m.lit).expect("rename_all requires lit str");
                    let t = match s.value().as_str() {
                        "camelCase" => RenameAll::CamelCase,
                        _ => panic!(""),
                    };
                    rename_all = Some(t);
                }
                Meta(NameValue(m)) if m.path == FILE_NAME => {
                    let s = get_lit_str(&m.lit).expect("file_name requires lit str");
                    file_name = Some(s.value());
                }
                Meta(NameValue(m)) if m.path == RENAME => {
                    let s = get_lit_str(&m.lit).expect("file_name requires lit str");
                    rename = Some(s.value());
                }
                _ => panic!("unexpected attr"),
            }
        }
        match &item.data {
            syn::Data::Struct(ds) => {
                let fields = ds
                    .fields
                    .iter()
                    .map(|f| Field::from_field(f))
                    .collect::<Vec<_>>();
                Contianer {
                    file_name: file_name.expect("file name are required"),
                    is_enum: false,
                    fields,
                    rename_all,
                    ident: &item.ident,
                    rename,
                }
            }
            syn::Data::Enum(e) => {
                let fields = e
                    .variants
                    .iter()
                    .map(|v| Field::from_variant(v))
                    .collect::<Vec<_>>();
                Contianer {
                    file_name: file_name.unwrap(),
                    is_enum: true,
                    fields,
                    rename_all,
                    ident: &item.ident,
                    rename,
                }
            }
            _ => panic!("Not support the union type"),
        }
    }
}

pub struct Field<'a> {
    pub rename: Option<String>,
    pub ident: &'a Ident,
    pub ty: Option<&'a Type>, // enum ty can be None.
    pub skip: bool,
}

impl<'a> Field<'a> {
    pub fn from_field(f: &'a syn::Field) -> Self {
        let attrs = parse_attrs(&f.attrs);
        Field {
            rename: attrs.rename,
            ident: f.ident.as_ref().unwrap(),
            ty: Some(&f.ty),
            skip: attrs.skip,
        }
    }

    pub fn from_variant(v: &'a syn::Variant) -> Self {
        let attrs = parse_attrs(&v.attrs);
        if v.fields.len() > 1 {
            panic!("not implemented yet")
        }
        let field = &v.fields.iter().next();
        let ty = match field {
            Some(f) => Some(&f.ty),
            None => None,
        };
        Field {
            rename: attrs.rename,
            ident: &v.ident,
            ty,
            skip: attrs.skip,
        }
    }
}

fn parse_attrs<'a>(attrs: &'a Vec<Attribute>) -> FieldAttrs {
    let mut skip = false;
    let mut rename: Option<String> = None;
    for meta_item in attrs
        .iter()
        .flat_map(|attr| get_ts_meta_items(attr))
        .flatten()
    {
        match meta_item {
            Meta(NameValue(m)) if m.path == RENAME => {
                if let Ok(s) = get_lit_str(&m.lit) {
                    rename = Some(s.value());
                }
            }
            Meta(NameValue(m)) if m.path == SKIP => {
                if let Ok(s) = get_lit_bool(&m.lit) {
                    skip = s;
                } else {
                    panic!("expected bool value in skip attr")
                }
            }
            _ => {}
        }
    }
    FieldAttrs { skip, rename }
}

struct FieldAttrs {
    skip: bool,
    rename: Option<String>,
}

pub enum RenameAll {
    CamelCase,
}

fn get_ts_meta_items(attr: &syn::Attribute) -> Result<Vec<syn::NestedMeta>, ()> {
    if attr.path != TS {
        return Ok(Vec::new());
    }

    match attr.parse_meta() {
        Ok(List(meta)) => Ok(meta.nested.into_iter().collect()),
        Ok(_) => Err(()),
        Err(_) => Err(()),
    }
}

fn get_lit_str<'a>(lit: &'a syn::Lit) -> Result<&'a syn::LitStr, ()> {
    if let syn::Lit::Str(lit) = lit {
        Ok(lit)
    } else {
        Err(())
    }
}

fn get_lit_bool<'a>(lit: &'a syn::Lit) -> Result<bool, ()> {
    if let syn::Lit::Bool(b) = lit {
        Ok(b.value)
    } else {
        Err(())
    }
}
