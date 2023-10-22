import { NS } from "@ns";
import { Host } from "v2/interfaces"

function SeenHostname(all_info: Host[], hostname: string ): boolean {
    for (const info of all_info) {
        if (info.id === hostname) return true
    }
    return false
}

function crawl3(ns: NS, cur_info: Host, depth: number, prev_seen: Host[], max_depth: number = 10): Host[] {
	if (depth > max_depth) return [];
	let new_seen: Host[] = []

	for (const server of cur_info.connections) {
        if (server == "home") continue
		if (SeenHostname(prev_seen, server)) continue
		if (SeenHostname(new_seen, server)) continue
        const new_info: Host = {id: server, connections: ns.scan(server)}
		new_seen.push(new_info)
		const tmp_seen = prev_seen.concat(new_seen)
		new_seen = new_seen.concat(crawl3(ns, new_info, depth + 1, tmp_seen, max_depth))
	}
	return new_seen
}


/** @param {NS} ns */
export async function main(ns: NS) {

    const depth = 20

    const hostname = ns.getHostname()
    const start_host: Host = {id: hostname, connections: ns.scan(hostname)}
    let all_info = crawl3(ns, start_host, 0, [], depth)
    all_info.push(start_host)
    ns.tprint(`Found ${all_info.length} servers`)

}



