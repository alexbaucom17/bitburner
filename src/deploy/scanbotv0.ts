import { NS } from "@ns";

// Copied from lib, don't modify here!
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
// End copy section


const comm_port = 6

/** @param {NS} ns */
export async function main(ns: NS) {

    const all_info = crawl2(ns, {hostname: ns.getHostname(), path: []}, 0, [])
    let send_str = `${ns.getHostname()}\n`
    for (const info of all_info) {
        let out_str = `${info.hostname},`
        for (const path_step of info.path) {
            out_str = out_str.concat(`${path_step},`)
        }
        // Remove final comma and add new line
        out_str = out_str.slice(0, -1).concat("\n")
        send_str = send_str.concat(out_str)
    }
    let port = ns.getPortHandle(comm_port)
    port.write(send_str)
}