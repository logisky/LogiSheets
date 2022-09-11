use crate::symbol::{
    DEFAULT, NAME, ROOT, SKIP_SERIALIZING, TYPE, VEC_SIZE, WITH_CUSTOM_NS, WITH_NS, XML_SERDE,
};
use proc_macro2::{Group, Span, TokenStream, TokenTree};
use syn::parse::{self, Parse};
use syn::Meta::List;
use syn::Meta::NameValue;
use syn::Meta::Path;
use syn::NestedMeta::Lit;
use syn::NestedMeta::Meta;
use syn::Variant;

pub struct Container<'a> {
    pub struct_fields: Vec<StructField<'a>>, // Struct fields
    pub enum_variants: Vec<EnumVariant<'a>>,
    pub original: &'a syn::DeriveInput,
    pub with_ns: Option<syn::LitByteStr>,
    pub custom_ns: Vec<(syn::LitByteStr, syn::LitByteStr)>,
    pub root: Option<syn::LitByteStr>,
}

impl<'a> Container<'a> {
    pub fn is_enum(&self) -> bool {
        self.enum_variants.len() > 0
    }

    pub fn from_ast(item: &'a syn::DeriveInput, _derive: Derive) -> Container<'a> {
        let mut with_ns = Option::<syn::LitByteStr>::None;
        let mut custom_ns = Vec::<(syn::LitByteStr, syn::LitByteStr)>::new();
        let mut root = Option::<syn::LitByteStr>::None;
        for meta_item in item
            .attrs
            .iter()
            .flat_map(|attr| get_xmlserde_meta_items(attr))
            .flatten()
        {
            match meta_item {
                Meta(NameValue(m)) if m.path == WITH_NS => {
                    if let Ok(s) = get_lit_byte_str(&m.lit) {
                        with_ns = Some(s.clone());
                    }
                }
                Meta(NameValue(r)) if r.path == ROOT => {
                    if let Ok(s) = get_lit_byte_str(&r.lit) {
                        root = Some(s.clone());
                    }
                }
                Meta(List(l)) if l.path == WITH_CUSTOM_NS => {
                    let mut iter = l.nested.into_iter();
                    let first = iter
                        .next()
                        .expect("with_custom_ns should at least 2 arguments");
                    let second = iter
                        .next()
                        .expect("with_custom_ns should at least 2 arguments");
                    match (first, second) {
                        (Lit(f), Lit(s)) => {
                            let f = get_lit_byte_str(&f).unwrap().clone();
                            let s = get_lit_byte_str(&s).unwrap().clone();
                            custom_ns.push((f, s));
                        }
                        _ => panic!(r#"with_custom_ns(b"r", b"ns")"#),
                    }
                }
                _ => panic!("unexpected attr in struct"),
            }
        }
        match &item.data {
            syn::Data::Struct(ds) => {
                let fields = ds
                    .fields
                    .iter()
                    .map(|f| StructField::from_ast(f))
                    .filter(|f| f.is_some())
                    .map(|f| f.unwrap())
                    .collect::<Vec<_>>();
                Container {
                    struct_fields: fields,
                    enum_variants: vec![],
                    original: item,
                    with_ns,
                    custom_ns,
                    root,
                }
            }
            syn::Data::Enum(e) => {
                let variants = e
                    .variants
                    .iter()
                    .map(|v| EnumVariant::from_ast(v))
                    .collect::<Vec<_>>();
                Container {
                    struct_fields: vec![],
                    enum_variants: variants,
                    original: item,
                    with_ns,
                    custom_ns,
                    root,
                }
            }
            syn::Data::Union(_) => panic!("Only support struct and enum type, union is found"),
        }
    }
}

pub struct FieldsSummary<'a> {
    pub children: Vec<StructField<'a>>,
    pub text: Option<StructField<'a>>,
    pub attrs: Vec<StructField<'a>>,
    pub self_closed_children: Vec<StructField<'a>>,
    pub untags: Vec<StructField<'a>>,
}

impl<'a> FieldsSummary<'a> {
    pub fn from_fields(fields: Vec<StructField<'a>>) -> Self {
        let mut result = FieldsSummary {
            children: vec![],
            text: None,
            attrs: vec![],
            self_closed_children: vec![],
            untags: vec![],
        };
        fields.into_iter().for_each(|f| match f.ty {
            EleType::Attr => result.attrs.push(f),
            EleType::Child => result.children.push(f),
            EleType::Text => result.text = Some(f),
            EleType::SelfClosedChild => result.self_closed_children.push(f),
            EleType::Untag => result.untags.push(f),
        });
        result
    }
}

pub struct StructField<'a> {
    pub ty: EleType,
    pub name: Option<syn::LitByteStr>,
    pub skip_serializing: bool,
    pub default: Option<syn::ExprPath>,
    pub original: &'a syn::Field,
    pub vec_size: Option<syn::Lit>,
    pub generic: Generic<'a>,
}

impl<'a> StructField<'a> {
    pub fn from_ast(f: &'a syn::Field) -> Option<Self> {
        let mut name = Option::<syn::LitByteStr>::None;
        let mut skip_serializing = false;
        let mut default = Option::<syn::ExprPath>::None;
        let mut ty = Option::<EleType>::None;
        let mut vec_size = Option::<syn::Lit>::None;
        let generic = get_generics(&f.ty);
        for meta_item in f
            .attrs
            .iter()
            .flat_map(|attr| get_xmlserde_meta_items(attr))
            .flatten()
        {
            match meta_item {
                Meta(NameValue(m)) if m.path == NAME => {
                    if let Ok(s) = get_lit_byte_str(&m.lit) {
                        name = Some(s.clone());
                    }
                }
                Meta(NameValue(m)) if m.path == TYPE => {
                    if let Ok(s) = get_lit_str(&m.lit) {
                        let t = match s.value().as_str() {
                            "attr" => EleType::Attr,
                            "child" => EleType::Child,
                            "text" => EleType::Text,
                            "sfc" => EleType::SelfClosedChild,
                            "untag" => EleType::Untag,
                            _ => panic!(""),
                        };
                        ty = Some(t);
                    }
                }
                Meta(NameValue(m)) if m.path == VEC_SIZE => match m.lit {
                    syn::Lit::Str(_) | syn::Lit::Int(_) => {
                        vec_size = Some(m.lit);
                    }
                    _ => panic!(),
                },
                Meta(Path(word)) if word == SKIP_SERIALIZING => {
                    skip_serializing = true;
                }
                Meta(NameValue(m)) if m.path == DEFAULT => {
                    if let Ok(path) = parse_lit_into_expr_path(&m.lit) {
                        default = Some(path);
                    }
                }
                Meta(_) => {
                    let s = format!("UNKNOWNED xmlserde variant attribute");
                    panic!("{}", s);
                }
                Lit(_) => unimplemented!(),
            }
        }
        if ty.is_none() {
            None
        } else {
            Some(StructField {
                ty: ty.unwrap(),
                name,
                skip_serializing,
                default,
                original: f,
                vec_size,
                generic,
            })
        }
    }

    pub fn is_required(&self) -> bool {
        if matches!(self.ty, EleType::Untag) {
            return match self.generic {
                Generic::Vec(_) => false,
                Generic::Opt(_) => false,
                Generic::None => true,
            };
        }
        self.default.is_none()
            && matches!(self.generic, Generic::None)
            && !matches!(self.ty, EleType::SelfClosedChild)
    }
}

pub struct EnumVariant<'a> {
    pub name: syn::LitByteStr,
    pub ident: &'a syn::Ident,
    pub ty: &'a syn::Type,
}

impl<'a> EnumVariant<'a> {
    pub fn from_ast(v: &'a Variant) -> Self {
        let mut name = Option::<syn::LitByteStr>::None;
        for meta_item in v
            .attrs
            .iter()
            .flat_map(|attr| get_xmlserde_meta_items(attr))
            .flatten()
        {
            match meta_item {
                Meta(NameValue(m)) if m.path == NAME => {
                    if let Ok(s) = get_lit_byte_str(&m.lit) {
                        name = Some(s.clone());
                    }
                }
                _ => panic!("Invalid attr"),
            }
        }
        let ty = &v.fields.iter().next().unwrap().ty;
        let ident = &v.ident;
        EnumVariant {
            name: name.unwrap(),
            ty,
            ident,
        }
    }
}

/// Specify where this field is in the xml.
pub enum EleType {
    Attr,
    Child,
    Text,
    ///
    /// ```
    /// struct Font {
    ///     bold: bool,
    ///     italic: bool,
    /// }
    /// ```
    /// In the xml, it is like
    /// <font>
    ///     <b/>
    ///     <i/>
    /// </font>
    /// In this case, </b> indicates the field *bold* is true and <i/> indicates *italic* is true.
    SelfClosedChild,
    Untag,
}

pub enum Derive {
    Serialize,
    Deserialize,
}

fn get_xmlserde_meta_items(attr: &syn::Attribute) -> Result<Vec<syn::NestedMeta>, ()> {
    if attr.path != XML_SERDE {
        return Ok(Vec::new());
    }

    match attr.parse_meta() {
        Ok(List(meta)) => Ok(meta.nested.into_iter().collect()),
        Ok(_) => {
            Err(())
            // panic!("expected #[xmlserde(...)]")
        }
        Err(_) => Err(()),
    }
}

fn get_lit_byte_str<'a>(lit: &'a syn::Lit) -> Result<&'a syn::LitByteStr, ()> {
    if let syn::Lit::ByteStr(bl) = lit {
        Ok(bl)
    } else {
        Err(())
    }
}

fn get_lit_str<'a>(lit: &'a syn::Lit) -> Result<&'a syn::LitStr, ()> {
    if let syn::Lit::Str(lit) = lit {
        Ok(lit)
    } else {
        Err(())
    }
}

pub fn parse_lit_into_expr_path(lit: &syn::Lit) -> Result<syn::ExprPath, ()> {
    let string = get_lit_str(lit)?;
    match parse_lit_str(string) {
        Ok(r) => Ok(r),
        Err(_) => {
            let _ = format!("failed to parse path: {:?}", string.value());
            Err(())
            // panic!("{:?}", msg)
        }
    }
}

pub fn parse_lit_str<T>(s: &syn::LitStr) -> parse::Result<T>
where
    T: Parse,
{
    let tokens = spanned_tokens(s)?;
    syn::parse2(tokens)
}

fn spanned_tokens(s: &syn::LitStr) -> parse::Result<TokenStream> {
    let stream = syn::parse_str(&s.value())?;
    Ok(respan(stream, s.span()))
}

fn respan(stream: TokenStream, span: Span) -> TokenStream {
    stream
        .into_iter()
        .map(|token| respan_token(token, span))
        .collect()
}

fn respan_token(mut token: TokenTree, span: Span) -> TokenTree {
    if let TokenTree::Group(g) = &mut token {
        *g = Group::new(g.delimiter(), respan(g.stream(), span));
    }
    token.set_span(span);
    token
}

fn get_generics(t: &syn::Type) -> Generic {
    match t {
        syn::Type::Path(p) => {
            let path = &p.path;
            match path.segments.last() {
                Some(seg) => {
                    if seg.ident.to_string() == "Vec" {
                        match &seg.arguments {
                            syn::PathArguments::AngleBracketed(a) => {
                                let args = &a.args;
                                if args.len() != 1 {
                                    Generic::None
                                } else {
                                    if let Some(syn::GenericArgument::Type(t)) = args.first() {
                                        Generic::Vec(t)
                                    } else {
                                        Generic::None
                                    }
                                }
                            }
                            _ => Generic::None,
                        }
                    } else if seg.ident.to_string() == "Option" {
                        match &seg.arguments {
                            syn::PathArguments::AngleBracketed(a) => {
                                let args = &a.args;
                                if args.len() != 1 {
                                    Generic::None
                                } else {
                                    if let Some(syn::GenericArgument::Type(t)) = args.first() {
                                        Generic::Opt(t)
                                    } else {
                                        Generic::None
                                    }
                                }
                            }
                            _ => Generic::None,
                        }
                    } else {
                        Generic::None
                    }
                }
                None => Generic::None,
            }
        }
        _ => Generic::None,
    }
}

pub enum Generic<'a> {
    Vec(&'a syn::Type),
    Opt(&'a syn::Type),
    None,
}

impl<'a> Generic<'a> {
    pub fn is_vec(&self) -> bool {
        match self {
            Generic::Vec(_) => true,
            _ => false,
        }
    }

    pub fn is_opt(&self) -> bool {
        match self {
            Generic::Opt(_) => true,
            _ => false,
        }
    }

    pub fn get_vec(&self) -> Option<&syn::Type> {
        match self {
            Generic::Vec(v) => Some(v),
            _ => None,
        }
    }

    pub fn get_opt(&self) -> Option<&syn::Type> {
        match self {
            Generic::Opt(v) => Some(v),
            _ => None,
        }
    }
}
