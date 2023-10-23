import { NS } from "@ns";

function getAllPortHacks(): string[] {
	return [
		"BruteSSH.exe",
		"FTPCrack.exe",
		"relaySMTP.exe",
		"HTTPWorm.exe",
		"SQLInject.exe"
	]
}

function runPortHack(ns: NS, port_hack: string, hostname: string) {
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

export function maybeGetRoot(ns: NS, hostname: string): boolean {
	if (ns.hasRootAccess(hostname)) return true;
	if (ns.getServerNumPortsRequired(hostname) > getAvailablePortHacks(ns).length) return false;
	for (const port_hack of getAvailablePortHacks(ns)) {
		ns.tprint(`Running ${port_hack} against ${hostname}`)
		runPortHack(ns, port_hack, hostname)
	}
	ns.nuke(hostname)
	return ns.hasRootAccess(hostname)
}

function getAvailablePortHacks(ns: NS): string[] {
	let availableHacks = []
	for (const hackfile of getAllPortHacks()) {
		if (ns.fileExists(hackfile)) availableHacks.push(hackfile)
	}
	return availableHacks
}

export function maxNumPortsHackable(ns: NS): number {
	return getAvailablePortHacks(ns).length
}

export function canBotnet(ns: NS, hostname: string, max_ports_hackable: number, min_ram: number = 4): boolean {
	if (ns.getServerMaxRam(hostname) < min_ram) return false
	if (ns.hasRootAccess(hostname)) return true
	const num_ports_needed = ns.getServerNumPortsRequired(hostname)
	if (num_ports_needed <= max_ports_hackable) return true
	return false
}