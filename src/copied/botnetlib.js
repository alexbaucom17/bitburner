export function getAllPortHacks() {
	return [
		"BruteSSH.exe",
		"FTPCrack.exe",
		"relaySMTP.exe",
		"HTTPWorm.exe",
		"SQLInject.exe"
	]
}

export function runPortHack(ns, port_hack, hostname) {
	switch (port_hack) {
		case "BruteSSH.exe":
			ns.brutessh(hostname)
			break;
		case "FTPCrack.exe":
			ns.ftpcrack(hostname)
			break;
		case "relaySMTP.exe":
			ns.relaysmtp(hostname)
			break;
		case "HTTPWorm.exe":
			ns.httpworm(hostname)
			break;
		case "SQLInject.exe":
			ns.sqlinject(hostname)
			break;
	}
}

export function maybeGetRoot(ns, hostname) {
	if (ns.hasRootAccess(hostname)) return true;
	for (const port_hack of getAvailblePortHacks(ns)) {
		ns.tprint(`Running ${port_hack} against ${hostname}`)
		runPortHack(ns, port_hack, hostname)
	}
	ns.nuke(hostname)
	return ns.hasRootAccess(hostname)
}

export function getAvailblePortHacks(ns) {
	let availableHacks = []
	for (const hackfile of getAllPortHacks()) {
		if (ns.fileExists(hackfile)) availableHacks.push(hackfile)
	}
	return availableHacks
}

export function maxNumPortsHackable(ns) {
	return getAvailblePortHacks(ns).length
}

export function canBotnet(ns, hostname, max_ports_hackable, min_ram = 4) {
	if (ns.getServerMaxRam(hostname) < min_ram) return false
	if (ns.hasRootAccess(hostname)) return true
	const num_ports_needed = ns.getServerNumPortsRequired(hostname)
	if (num_ports_needed <= max_ports_hackable) return true
	return false
}

export function canHack(ns, hostname) {
	const server_hack_level = ns.getServerRequiredHackingLevel(hostname)
	if (ns.getHackingLevel() >= server_hack_level) return true
	return false
}

export function crawl(ns, hostname, depth, prev_seen, max_depth = 10) {
	if (depth > max_depth) return [];
	let new_seen = []

	const servers = ns.scan(hostname)
	for (const server of servers) {
		if (prev_seen.includes(server)) continue;
		if (new_seen.includes(server)) continue;
		new_seen.push(server)
		const tmp_seen = prev_seen.concat(new_seen)
		new_seen = new_seen.concat(crawl(ns, server, depth + 1, tmp_seen, max_depth))
	}
	return new_seen
}

export function getHackInfo(ns, hostname) {
	return {
		maxMoney: ns.getServerMaxMoney(hostname),
		curMoney: ns.getServerMoneyAvailable(hostname),
		minSecurity: ns.getServerMinSecurityLevel(hostname),
		curSecurity: ns.getServerSecurityLevel(hostname),
		reqHackLevel: ns.getServerRequiredHackingLevel(hostname),
	}
}