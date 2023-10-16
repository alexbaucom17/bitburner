export interface Host {
    id: string
    connections: string[]
}
export enum BotMode {
    Hack,
    Scan
}
export enum HackMode {
    MaxMoney,
    MaxRank,
    Custom
}
export interface HackModeInfo {
    hack_mode: HackMode
    target: string
    threads: number | undefined
    file: string | undefined
}
export interface ScanModeInfo {
    prioritize: boolean
}
export interface BotModeInfo {
    mode: BotMode
    hack_info: HackModeInfo | undefined
    scan_info: ScanModeInfo | undefined
}
export interface ActiveBotModeInfo {
    bot_mode: BotModeInfo
    pid: number
}