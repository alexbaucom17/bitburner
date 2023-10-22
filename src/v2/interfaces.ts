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
export type HackInfo = {
    maxMoney: number;
    curMoney: number;
    minSecurity: number;
    curSecurity: number;
    reqHackLevel: number;
};

export type TargetRankingInfo = {
    hostname: string;
    hackInfo: HackInfo;
    score: number
}