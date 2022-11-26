import { NS } from "@ns";
import {scan_deploy_file, scan_data_port, scan_state_file} from "constants"
import {maybeGetRoot} from "botnet/utils"

// Keep these in sync with scanbot
type CrawlInfo = {
    hostname: string
    path: string[]
}

function SeenHostname(all_info: CrawlInfo[], hostname: string ): boolean {
    for (const info of all_info) {
        if (info.hostname === hostname) return true
    }
    return false
}

function crawl2(ns: NS, cur_info: CrawlInfo, depth: number, prev_seen: CrawlInfo[], max_depth: number = 10): CrawlInfo[] {
	if (depth > max_depth) return [];
	let new_seen: CrawlInfo[] = []

	const servers = ns.scan(cur_info.hostname)
	for (const server of servers) {
        if (server == "home") continue
		if (SeenHostname(prev_seen, server)) continue
		if (SeenHostname(new_seen, server)) continue
        const new_path = cur_info.path.concat(server)
        const new_info: CrawlInfo = {hostname: server, path: new_path}
		new_seen.push(new_info)
		const tmp_seen = prev_seen.concat(new_seen)
		new_seen = new_seen.concat(crawl2(ns, new_info, depth + 1, tmp_seen, max_depth))
	}
	return new_seen
}
// End update section


// TODO: This could miss cases where there are deeper servers only visible from a branch of the 
// scan tree which doesn't get scanned due to the lowest server having 0B of ram to scan.
function IdentifyScanBots(ns: NS, local_crawl: CrawlInfo[]): CrawlInfo[] {
    let bot_targets = [] as CrawlInfo[]
    let max_depth = 0
    for (const info of local_crawl) {
        const depth = info.path.length
        if (depth > max_depth) {
            max_depth = depth
        }
    }
    while (bot_targets.length === 0) {
        for (const info of local_crawl) {
            const depth = info.path.length
            if (depth == max_depth && ns.getServerMaxRam(info.hostname) > 2) {
                bot_targets.push(info)
            }
        }
        max_depth -= 1
    }
    return bot_targets
}

function DeployScanBots(ns: NS, deploy_bots: CrawlInfo[], deploy_file: string) {
    for (const info of deploy_bots) {
        if(!maybeGetRoot(ns, info.hostname)) {
            ns.tprint(`Could not get root on ${info.hostname}, skipping`)
            continue
        }
        const scp_ok = ns.scp(deploy_file, info.hostname)
        if (!scp_ok) {
            throw Error(`Could not scp ${deploy_file} to ${info.hostname}`)
        }
        // ns.tprint(`SCPd ${deploy_file} to ${info.hostname}`)
        ns.exec(deploy_file, info.hostname, 1)
    }
}

type RemoteResult = {
    bot_hostname: string
    crawl_info: CrawlInfo[]
}

async function CollectRemoteResults(ns: NS, deploy_bots: CrawlInfo[]): Promise<RemoteResult[]> {
    let port = ns.getPortHandle(scan_data_port)
    let count = 0
    let wait_count = 0
    let results = [] as RemoteResult[]
    while(count < deploy_bots.length) {
        const raw_data = port.read()
        if (typeof raw_data === "number") continue
        if (raw_data === "NULL PORT DATA") {
            // ns.tprint("Waiting for remote results...")
            await ns.sleep(1000)
            wait_count += 1
            if(wait_count > 3) {
                // ns.tprint("Could not retrieve remote results")
                break
            }
            else continue
        }
        count += 1
        const lines = raw_data.split("\n")
        const bot_hostname = lines.at(0)
        if(!bot_hostname) continue
        let found_infos = [] as CrawlInfo[]
        for (const line of lines) {
            if(!line) continue
            const tokens = line.split(",")
            const found_hostname = tokens.at(0)
            const path = tokens.slice(1)
            const info = {hostname: found_hostname, path: path} as CrawlInfo
            found_infos.push(info)
        }

        results.push({bot_hostname: bot_hostname, crawl_info: found_infos})
    }
    return results
}

function FindLocalPath(local_crawl: CrawlInfo[], hostname: string): string[] | undefined {
    for(const info of local_crawl) {
        if(info.hostname === hostname) return info.path
    }
    return undefined
}

function MergePaths(local_path: string[], remote_path: string[]): string[] {
    let local_count = -2
    let remote_count = 0
    while(true) {
        const local_name = local_path.at(local_count)
        const remote_name = remote_path.at(remote_count)
        if (local_name === remote_name) {
            local_count -= 1
            remote_count += 1
            if (Math.abs(local_count) > local_path.length) {
                throw Error("Underflow of local_count")
            }
            if (remote_count > remote_path.length) {
                throw Error("Overflow of remote count")
            }
        } else {
            return local_path.slice(0, local_count).concat(remote_path.slice(remote_count))
        }
    }
}

function MergeAllResults(local_crawl: CrawlInfo[], remote_crawl: RemoteResult[]): CrawlInfo[] {
    let result = local_crawl
    for (const remote_info of remote_crawl) {
        const local_path = FindLocalPath(local_crawl, remote_info.bot_hostname)
        if (!local_path) throw Error(`Could not find local path to ${remote_info.bot_hostname}`)
        for (const info of remote_info.crawl_info) {
            const existing_path = FindLocalPath(result, info.hostname)
            if (existing_path) continue
            result.push({hostname: info.hostname, path: MergePaths(local_path, info.path)})
        }
    }
    return result
}

function PrintCrawlInfo(ns: NS, crawl_info: CrawlInfo[], title: string) {
    ns.tprint(title)
    for (const info of crawl_info) {
        let out_str = `${info.hostname}: `
        for (const path_step of info.path) {
            out_str = out_str.concat(`${path_step}>`)
        }
        ns.tprint(out_str)
    }
}

function PrintRemoteInfo(ns: NS, remote_info: RemoteResult[], title: string) {
    ns.tprint(title)
    for (const result of remote_info) {
        PrintCrawlInfo(ns, result.crawl_info, `Remote result from ${result.bot_hostname}`)
    }
}

async function PerformRemoteScan(ns: NS, known_hosts: CrawlInfo[]): Promise<CrawlInfo[]> {
    const bot_targets = IdentifyScanBots(ns, known_hosts)
    // PrintCrawlInfo(ns, bot_targets, "bot_targets")
    DeployScanBots(ns, bot_targets, scan_deploy_file)
    const remote_crawl = await CollectRemoteResults(ns, bot_targets)
    // PrintRemoteInfo(ns, remote_crawl, "remote_crawl")
    return MergeAllResults(known_hosts, remote_crawl)
}

function UpdateScanFile(ns: NS, known_hosts: CrawlInfo[]) {
    let write_str = ""
    for (const info of known_hosts) {
        let out_str = `${info.hostname}:`
        for (const path_step of info.path) {
            out_str = out_str.concat(`${path_step}>`)
        }
        write_str = write_str.concat(out_str.slice(0,-1).concat("\n"))
    }
    ns.write(scan_state_file, write_str, "w")
}

function LoadHostsFromScanFile(ns: NS): CrawlInfo[] {
    const raw_data = ns.read(scan_state_file)
    if(!raw_data) {
        throw Error(`State file ${scan_state_file} does not exist or is empty`)
    }
    let host_info = [] as CrawlInfo[]
    let lines = raw_data.split("\n")
    for (let line of lines){
        if(!line) continue
        let data = line.split(":")
        const hostname = data[0]
        const path = data[1].split(">")
        host_info.push({hostname: hostname, path:path})
    }
    return host_info
}

export function GetAllHostnames(ns: NS): string[] {
	const crawl_info = LoadHostsFromScanFile(ns)
    return crawl_info.map(info => info.hostname)
}

export async function PerformFullScan(ns: NS): Promise<CrawlInfo[]> {

    let known_hosts = crawl2(ns, {hostname: "home", path: []}, 0, [])
    known_hosts.push({hostname: "home", path: ["home"]})
    // PrintCrawlInfo(ns, local_crawl, "local_crawl")
    while(true) {
        // ns.tprint("Performing remote scan")
        const new_known_hosts = await PerformRemoteScan(ns, known_hosts.slice(0))
        const num_new = new_known_hosts.length - known_hosts.length
        // ns.tprint(`Found ${num_new} new hosts`)
        if (num_new === 0) break
        known_hosts = new_known_hosts.slice(0)
    }
    UpdateScanFile(ns, known_hosts)
    return known_hosts
}

// export async function main(ns: NS) {
//     const all_info = await PerformFullScan(ns)
//     PrintCrawlInfo(ns, all_info, "all_info")
// }