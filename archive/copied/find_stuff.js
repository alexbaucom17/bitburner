import * as botnetlib from './botnetlib.js'

const crawl_distance = 10

async function FindFiles(ns, hostname) {
	const host_files = ns.ls(hostname)
	const home_files = ns.ls("home")
	for (const file of host_files) {
		if(file.endsWith(".js")) continue
		if(!home_files.includes(file)){
			ns.tprint(`Found file ${file} on ${hostname}`)
			if(file.endsWith(".cct")) continue
			await ns.scp(file, "home", hostname)
		}
	}
}

/** @param {NS} ns */
export async function main(ns) {
	const all_hosts = botnetlib.crawl(ns, "home", 0, [], crawl_distance)
	all_hosts.forEach(async (hostname) => await FindFiles(ns, hostname))
}