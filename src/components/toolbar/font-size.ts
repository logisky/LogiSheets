export interface FontSize {
    readonly cnName: string
    readonly pt: number
    readonly px: number
    readonly mm: number
}
// https://max.book118.com/html/2017/0407/99117916.shtm
export const FONT_SIZE_LIST: readonly FontSize[] = [
    {cnName: '1英寸', mm: 25.3, pt: 72.0, px: 95.6},
    {cnName: '大特号', mm: 22.14, pt: 63, px: 83.7},
    {cnName: '特号 ', mm: 18.97, pt: 54, px: 71.7},
    {cnName: '初号 ', mm: 14.82, pt: 42, px: 56},
    {cnName: '小初 ', mm: 12.7, pt: 36, px: 48},
    {cnName: '一号 ', mm: 9.17, pt: 26, px: 34.7},
    {cnName: '小一 ', mm: 8.47, pt: 24, px: 32},
    {cnName: '二号 ', mm: 7.76, pt: 22, px: 29.3},
    {cnName: '小二 ', mm: 6.35, pt: 18, px: 24},
    {cnName: '三号 ', mm: 5.64, pt: 16, px: 21.3},
    {cnName: '小三 ', mm: 5.29, pt: 15, px: 20},
    {cnName: '四号 ', mm: 4.94, pt: 14, px: 18.7},
    {cnName: '小四 ', mm: 4.23, pt: 12, px: 16},
    {cnName: '五号 ', mm: 3.7, pt: 10.5, px: 14},
    {cnName: '小五 ', mm: 3.18, pt: 9, px: 12},
    {cnName: '六号 ', mm: 2.56, pt: 7.5, px: 10},
    {cnName: '小六 ', mm: 2.29, pt: 6.5, px: 8.7},
    {cnName: '七号 ', mm: 1.94, pt: 5.5, px: 7.3},
    {cnName: '八号 ', mm: 1.76, pt: 5, px: 6.7},
]
