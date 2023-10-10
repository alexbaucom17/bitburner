import {HackMode} from "v2/interfaces"

// TODO: Clean up this file

export enum BotnetMode {
    AUTO,
    MANUAL,
    RANK_MAX
}

export const known_files = [
    "/deploy/botnetv0.js",
    "/deploy/rank_max.js",
    "/deploy/scanbotv0.js"
]


export const comm_port = 5
export const deploy_file = "/deploy/botnetv0.js"
export const rank_max_file = "/deploy/rank_max.js"
export const max_crawl_distance = 10
export const other_reserved_ram = 4
export const home_reserved_ram = 24
export const manual_target = "joesguns"
export const rank_max_target = "joesguns"
export const state_file = "/botnet/botnet_state.txt"
export const write_state_time = 60 * 1000 //ms
export const rank_target_time = 300 * 1000 //ms
export const purchase_server_time = 300 * 1000 //ms
export const buy_hacknets_time = 300 * 1000 //ms
export const min_purchase_server_ram = 8
export const purchase_server_cost_fraction = 0.1
export const server_ranking_divisor = 2
export const scan_deploy_file = "/deploy/scanbotv0.js"
export const scan_data_port = 6
export const scan_state_file = "/scannet/scan_state.txt"
export const files_to_clean = [
    "/deploy/botnetv0.js",
    "/deploy/rank_max.js",
]
export const mode = BotnetMode.AUTO

export const hack_files = new Map<HackMode, string>([
    [HackMode.MaxMoney, "/deploy/botnetv0.js"],
    [HackMode.MaxRank, "/deploy/rank_max.js"],
])