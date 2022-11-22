import { NS } from "@ns";

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

/** @param {NS} ns */
export async function main(ns: NS) {

    const all_info = crawl2(ns, {hostname: "home", path: []}, 0, [])
    for (const info of all_info) {
        let out_str = `${info.hostname}: `
        for (const path_step of info.path) {
            out_str = out_str.concat(`${path_step}>`)
        }
        ns.tprint(out_str)
    }

}



