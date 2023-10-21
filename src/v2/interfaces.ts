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
export interface HackModeRequest {
    hack_mode: HackMode
    target: string
    threads: number | undefined
    file: string | undefined
}
export interface ActiveHackModeInfo {
    hack_mode: HackMode
    target: string
    threads: number
    file: string
    pid: number
}
export interface ScanModeInfo {
    prioritize: boolean
}
export interface BotModeInfo {
    mode: BotMode
    hack_info: HackModeRequest | undefined
    scan_info: ScanModeInfo | undefined
}