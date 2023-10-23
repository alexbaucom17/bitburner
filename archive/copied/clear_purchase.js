/** @param {NS} ns */
export async function main(ns) {
	const hosts = [
		"pserv-0-0",
		"pserv-1-0",
		"pserv-2-0",
		"pserv-3-0"
	]
	hosts.forEach((host) => ns.deleteServer(host))
}