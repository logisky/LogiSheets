export const Escape = (badString: string) =>
    badString
        .replace('&', '&amp;')
        .replace('"', '&quot;')
        .replace("'", '&apos;')
        .replace('>', '&gt;')
        .replace('<', '&lt;')

export const Extract = (data: string) =>
    data
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
