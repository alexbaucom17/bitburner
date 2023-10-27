import {HackMode} from "v2/interfaces"

export const known_files = [
    "/deploy/botnetv0.js",
]

export const home_reserved_ram = 48
export const server_sleep_time = 100
export const periodic_check_time = 300 * 1000 //ms
export const min_purchase_server_ram = 8
export const purchase_cost_fraction = 0.1
export const server_ranking_divisor = 2

export const hack_files = new Map<HackMode, string>([
    [HackMode.MaxMoney, "/deploy/botnetv0.js"],
    [HackMode.MaxRank, "/deploy/botnetv0.js"],
])