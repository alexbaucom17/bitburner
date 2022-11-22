import { NS } from "@ns";
import {scan_deploy_file, scan_data_port} from "constants"

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


function IdentifyScanBots(local_crawl: CrawlInfo[]): CrawlInfo[] {
    let bot_targets = [] as CrawlInfo[]
    let max_depth = 0
    for (const info of local_crawl) {
        const depth = info.path.length
        if (depth > max_depth) {
            max_depth = depth
        }
    }
    for (const info of local_crawl) {
        const depth = info.path.length
        if (depth == max_depth) {
            bot_targets.push(info)
        }
    }
    return bot_targets
}

function DeployScanBots(ns: NS, deploy_bots: CrawlInfo[], deploy_file: string) {
    for (const info of deploy_bots) {
        const scp_ok = ns.scp(deploy_file, info.hostname)
        if (!scp_ok) {
            throw Error(`Could not scp ${deploy_file} to ${info.hostname}`)
        }
        ns.tprint(`SCPd ${deploy_file} to ${info.hostname}`)
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
    let results = [] as RemoteResult[]
    while(!port.empty() && count < deploy_bots.length) {
        if(port.empty()) await ns.sleep(100)

        const raw_data = port.read()
        if (typeof raw_data === "number") continue
        count += 1
        const lines = raw_data.split("\n")
        const bot_hostname = lines.at(0)
        if(!bot_hostname) continue
        let found_infos = [] as CrawlInfo[]
        for (const line of lines) {
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

function MergeAllResults(local_crawl: CrawlInfo[], remote_crawl: RemoteResult[]): CrawlInfo[] {
    let result = local_crawl
    for (const remote_info of remote_crawl) {
        const local_path = FindLocalPath(local_crawl, remote_info.bot_hostname)
        if (!local_path) throw Error(`Could not find local path to ${remote_info.bot_hostname}`)
        for (const info of remote_info.crawl_info) {
            const existing_path = FindLocalPath(result, info.hostname)
            if (existing_path) continue
            result.push({hostname: info.hostname, path: local_path.concat(info.path)})
        }
    }
    return result
}

async function PerformFullScan(ns: NS): Promise<CrawlInfo[]> {

    const local_crawl = crawl2(ns, {hostname: "home", path: []}, 0, [])
    const bot_targets = IdentifyScanBots(local_crawl)
    DeployScanBots(ns, bot_targets, scan_deploy_file)
    const remote_crawl = await CollectRemoteResults(ns, bot_targets)
    return MergeAllResults(local_crawl, remote_crawl)
}

export async function main(ns: NS) {
    const all_info = await PerformFullScan(ns)
    for (const info of all_info) {
        let out_str = `${info.hostname}: `
        for (const path_step of info.path) {
            out_str = out_str.concat(`${path_step}>`)
        }
        ns.tprint(out_str)
    }
}