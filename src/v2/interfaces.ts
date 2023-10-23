export interface Host {
    id: string
    connections: string[]
}
export enum HackMode {
    MaxMoney,
    MaxRank,
    Custom
}
export interface HackModeRequest {
    hack_mode: HackMode
    target: string
    threads?: number
    file?: string
}
export interface ActiveHackModeInfo {
    hack_mode: HackMode
    target: string
    threads: number
    file: string
    pid: number
}
export type HackInfo = {
    maxMoney: number;
    curMoney: number;
    minSecurity: number;
    curSecurity: number;
    reqHackLevel: number;
}

export type TargetRankingInfo = {
    hostname: string;
    hackInfo: HackInfo;
    score: number
}