import { NS } from "@ns";
import * as constants from "constants"

// Types
export type BotState = {
    target: string;
    botnet_file: string;
    threads: number;
};
export type BotStateMap = Map<string, BotState> 

type HackInfo = {
    maxMoney: number;
    curMoney: number;
    minSecurity: number;
    curSecurity: number;
    reqHackLevel: number;
};

type TargetRankingInfo = {
    hostname: string;
    hackInfo: HackInfo;
    score: number
}


// Private helpers

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

function maybeGetRoot(ns: NS, hostname: string): boolean {
	if (ns.hasRootAccess(hostname)) return true;
	for (const port_hack of getAvailblePortHacks(ns)) {
		ns.tprint(`Running ${port_hack} against ${hostname}`)
		runPortHack(ns, port_hack, hostname)
	}
	ns.nuke(hostname)
	return ns.hasRootAccess(hostname)
}

function getAvailblePortHacks(ns: NS): string[] {
	let availableHacks = []
	for (const hackfile of getAllPortHacks()) {
		if (ns.fileExists(hackfile)) availableHacks.push(hackfile)
	}
	return availableHacks
}

function maxNumPortsHackable(ns: NS): number {
	return getAvailblePortHacks(ns).length
}

function canBotnet(ns: NS, hostname: string, max_ports_hackable: number, min_ram: number = 4): boolean {
	if (ns.getServerMaxRam(hostname) < min_ram) return false
	if (ns.hasRootAccess(hostname)) return true
	const num_ports_needed = ns.getServerNumPortsRequired(hostname)
	if (num_ports_needed <= max_ports_hackable) return true
	return false
}

function GetAllHostnames(ns: NS): string[] {
	return crawl(ns, "home", 0, [], constants.max_crawl_distance)
}

function getPotentialBots(ns: NS): string[] {
	const all_hostnames = GetAllHostnames(ns)
	let potential_bot_hostnames = []
	const max_ports_hackable = maxNumPortsHackable(ns)
	for (const hostname of all_hostnames) {
		if (canBotnet(ns, hostname, max_ports_hackable)) potential_bot_hostnames.push(hostname)
	}
	return potential_bot_hostnames
}

function ComputeThreads(ns: NS, hostname: string, deploy_file: string, reserved_ram=0): number {
	const script_ram = ns.getScriptRam(deploy_file)
	const max_ram = ns.getServerMaxRam(hostname) - reserved_ram
	return Math.floor(max_ram / script_ram)
}

// Public utils
export function crawl(ns: NS, hostname: string, depth: number, prev_seen: string[], max_depth: number = 10): string[] {
	if (depth > max_depth) return [];
	let new_seen: string[] = []

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

// Single bot functions
function StopBot(ns: NS, hostname: string, botnet_file: string) {
	const files = ns.ls(hostname, botnet_file)
	files.map((file) => ns.scriptKill(file, hostname))
	ns.tprint(`Stopped bot ${hostname}`)
}

function StartBot(ns: NS, hostname: string, target: string, deploy_file: string): number {
	if (!ns.fileExists(deploy_file, hostname)) {
		throw Error(`File ${deploy_file} does not exist on ${hostname}`)
	}
	const n_threads = ComputeThreads(ns, hostname, deploy_file)
	ns.exec(deploy_file, hostname, n_threads, target)
	ns.tprint(`Started ${hostname} with ${n_threads} threads`)
    return n_threads
}

function CleanBot(ns: NS, hostname: string, botnet_file: string) {
	StopBot(ns, hostname, botnet_file)
    if (hostname === "home") return
	const files = ns.ls(hostname, botnet_file)
	files.map((file) => ns.rm(file, hostname))
	ns.tprint(`Cleaned ${hostname}`)
}

async function DeployBot(ns: NS, hostname: string, target: string, deploy_file: string): Promise<BotState> {
	let n_threads = 0
    if (hostname !== "home") {
        const root_ok = maybeGetRoot(ns, hostname)
        if (!root_ok) {
            throw Error(`Could not get root access on ${hostname}`)
        }
        ns.tprint(`Root access OK on ${hostname}`)
        const scp_ok = await ns.scp(deploy_file, hostname)
        if (!scp_ok) {
            throw Error(`Could not scp ${deploy_file} to ${hostname}`)
        }
        ns.tprint(`SCPd ${deploy_file} to ${hostname}`)
        n_threads = StartBot(ns, hostname, target, deploy_file)
    } else {
        n_threads = ComputeThreads(ns, hostname, deploy_file, constants.home_reserved_ram)
        ns.run(deploy_file, n_threads, target)
    }
    return {target: target, botnet_file: deploy_file, threads: n_threads}
}


// Botnet functions
export function StopNet(ns: NS, states: BotStateMap) {
	ns.tprint("Stopping botnet...")
    states.forEach((state: BotState, hostname: string) => StopBot(ns, hostname, state.botnet_file))
	ns.tprint("Done")
}

export function CleanNet(ns: NS, states: BotStateMap) {
	ns.tprint("Cleaning botnet...")
	states.forEach((state: BotState, hostname: string) => CleanBot(ns, hostname, state.botnet_file))
    states.clear()
	ns.tprint("Done")
}

export function CleanAll(ns: NS, deploy_file: string) {
    const all_hosts = GetAllHostnames(ns)
    all_hosts.forEach((hostname: string) => CleanBot(ns, hostname, deploy_file))
    ns.tprint("Done")
}

export async function DeployNet(ns: NS, states: BotStateMap, target: string, deploy_file: string) {
	const potential_bots = getPotentialBots(ns)
	ns.tprint(`Deploying botnet with ${deploy_file} against ${target}...`)
	for (const hostname of potential_bots) {
        const cur_state = states.get(hostname)
        let needs_update = false
        if (cur_state) {
            needs_update = cur_state.botnet_file !== deploy_file || cur_state.target !== target
        }
        if (!cur_state || needs_update) {
            const new_state = await DeployBot(ns, hostname, target, deploy_file)
            states.set(hostname, new_state)
        }
	}
	ns.tprint("Done")
}

export function ShowStatusNet(ns: NS, states: BotStateMap) {
    let cur_target = null
    let cur_deploy_file = null
    let hostnames: string[] = []
    let num_threads = 0
	for(let [hostname, state] of states) {
        hostnames.push(hostname)
        num_threads += state.threads
        if(!cur_target) {
            cur_target = state.target
            cur_deploy_file = state.botnet_file
        }
    }   
    
    ns.tprint("Botnet Status")
	ns.tprint(` Target: ${cur_target}`)
	ns.tprint(` Num threads: ${num_threads}`)
	ns.tprint(` File: ${cur_deploy_file}`)
	ns.tprint(` Num bots: ${hostnames.length}`)
	// hostnames.forEach((hostname) => ns.tprint(`   ${hostname}`))
}


// Target ranking
function getHackInfo(ns: NS, hostname: string): HackInfo {
	return {
		maxMoney: ns.getServerMaxMoney(hostname),
		curMoney: ns.getServerMoneyAvailable(hostname),
		minSecurity: ns.getServerMinSecurityLevel(hostname),
		curSecurity: ns.getServerSecurityLevel(hostname),
		reqHackLevel: ns.getServerRequiredHackingLevel(hostname),
	}
}

function ScoreHost(ns: NS, hostname: string): TargetRankingInfo {
	const hackInfo = getHackInfo(ns, hostname)
	const myHackLevel = ns.getHackingLevel()

	const buildReturn = (score: number): TargetRankingInfo => {
		return {
			hostname: hostname,
			hackInfo: hackInfo,
			score: score
		}
	}

	const hackLevelThresh = myHackLevel / 3
	if (hackInfo.reqHackLevel > hackLevelThresh) return buildReturn(0)
	return buildReturn(hackInfo.maxMoney)

}

export function SelectBestTarget(ns: NS): string {
    const all_hosts = GetAllHostnames(ns)
    let best: TargetRankingInfo = {hostname: "", score: 0, hackInfo: getHackInfo(ns, "n00dles")}
	for (const host of all_hosts) {
		const score_results = ScoreHost(ns, host)
		if (score_results.score > best.score) {
			best = score_results
		}
	}
    ns.print(`Best target ${best.hostname} - ${best.score} {level_req: ${best.hackInfo.reqHackLevel}, max_money: ${best.hackInfo.maxMoney}}`)
    return best.hostname
}

// Server purchasing
function ComputeMaxRam(ns: NS, min_ram: number): number {
    const cur_money = ns.getServerMoneyAvailable("home")
    const max_spend = cur_money * constants.purchase_server_cost_fraction
    const max_servers = ns.getPurchasedServerLimit()
    let most_ram = 0
    let start_exponent = Math.floor(Math.log2(min_ram))
    for (let exp = start_exponent; exp <= 20; exp++) {
        const server_ram = 2**exp
        const server_cost = ns.getPurchasedServerCost(server_ram)
        const total_cost = max_servers * server_cost
        if (total_cost < max_spend) {
            most_ram = server_ram
        }
    }
    return most_ram
}

function MaybePurchaseNewServers(ns: NS): boolean {
    const max_ram = ComputeMaxRam(ns, constants.min_purchase_server_ram)
    if(max_ram === 0) return false
    ns.print("Purchasing new servers")
    for (let i = 0; i < ns.getPurchasedServerLimit(); i++) {
        ns.purchaseServer("pserv-" + i, max_ram);
        ns.print(`Purchase pserver-${i} with ${max_ram} ram`)
    }
    return true
}

function MaybeUpgradeServers(ns: NS, current_servers: string[]) : boolean {
    const cur_ram = ns.getServerMaxRam(current_servers[0])
    const max_ram = ComputeMaxRam(ns, cur_ram)
    if(max_ram === 0) return false
    ns.print("Upgrading servers")
    for (const hostname of current_servers) {
        ns.print(`"Deleing server ${hostname}`)
        StopBot(ns, hostname, constants.deploy_file)
        const ok = ns.deleteServer(hostname)
        if (!ok) ns.print(`Failed to delete ${hostname}`)
    }
    for (let i = 0; i < ns.getPurchasedServerLimit(); i++) {
        ns.purchaseServer("pserv-" + i, max_ram);
        ns.print(`Purchase pserver-${i} with ${max_ram} ram`)
    }
    return true
}

export function MaybePurchaseOrUpgradeServers(ns: NS): boolean {
    const current_servers = ns.getPurchasedServers()
    if(current_servers.length === 0) {
        return MaybePurchaseNewServers(ns)
    } else {
        return MaybeUpgradeServers(ns, current_servers)
    }
}