import { NS } from "@ns";
import * as constants from "constants"
import {GetAllHostnames} from "scannet/scanlib"
import { maybeGetRoot, maxNumPortsHackable, canBotnet } from "botnet/utils";

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
export function rootAllPossibleHosts(ns: NS) {
    const all_hostnames = GetAllHostnames(ns)
    all_hostnames.forEach(hostname => maybeGetRoot(ns, hostname))
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
	const n_threads = ComputeThreads(ns, hostname, deploy_file, constants.other_reserved_ram)
    if (n_threads === 0) return 0
	ns.exec(deploy_file, hostname, n_threads, target)
	ns.tprint(`Started ${hostname} with ${n_threads} threads`)
    return n_threads
}

function CleanBot(ns: NS, hostname: string, files_to_clean: string[]) {
	files_to_clean.forEach(file => StopBot(ns, hostname, file))
    if (hostname === "home") return
    for (const file of files_to_clean ){
        const files = ns.ls(hostname, file)
        files.map((file) => ns.rm(file, hostname))
    }
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
	states.forEach((state: BotState, hostname: string) => CleanBot(ns, hostname, constants.files_to_clean))
    states.clear()
	ns.tprint("Done")
}

export async function DeployNet(ns: NS, states: BotStateMap, target: string, deploy_file: string) {
    rootAllPossibleHosts(ns)
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
    const hasRoot = maybeGetRoot(ns, hostname)

	const buildReturn = (score: number): TargetRankingInfo => {
		return {
			hostname: hostname,
			hackInfo: hackInfo,
			score: score
		}
	}

	const hackLevelThresh = myHackLevel / constants.server_ranking_divisor
	if (hackInfo.reqHackLevel > hackLevelThresh || !hasRoot) return buildReturn(0)
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

// State checking
export function DetermineBotnetState(ns: NS, expected_deploy_file: string): BotStateMap {
    let botnet_states = new Map<string, BotState>()
    const all_hostnames = GetAllHostnames(ns)
    for (const hostname of all_hostnames) {
        const all_scripts = ns.ps(hostname)
        for (const process_info of all_scripts) {
            if(process_info.filename === expected_deploy_file) {
                const target = process_info.args[0]
                if (typeof target !== "string") continue
                botnet_states.set(hostname, {target: target, botnet_file: expected_deploy_file, threads: process_info.threads})
            }
        }
    }
    return botnet_states
}