import { NS } from "@ns";
import * as constants from "v2/constants2"
import {Host, HackMode, HackModeRequest, ActiveHackModeInfo, HackInfo, TargetRankingInfo} from "v2/interfaces";
import {buyAndUpgradeAllHacknetNodes} from "systems/hacknet"
import {buyAndUpgradeServers} from "systems/server_purchase"

// Helper functions
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

function getAvailablePortHacks(ns: NS): string[] {
	let availableHacks = []
	for (const hackfile of getAllPortHacks()) {
		if (ns.fileExists(hackfile)) availableHacks.push(hackfile)
	}
	return availableHacks
}

function maybeGetRoot(ns: NS, hostname: string): boolean {
	if (ns.hasRootAccess(hostname)) return true;
	if (ns.getServerNumPortsRequired(hostname) > getAvailablePortHacks(ns).length) return false;
	for (const port_hack of getAvailablePortHacks(ns)) {
		runPortHack(ns, port_hack, hostname)
	}
	ns.nuke(hostname)
	return ns.hasRootAccess(hostname)
}

function ComputeThreads(ns: NS, hostname: string, deploy_file: string, reserved_ram=0): number {
	const script_ram = ns.getScriptRam(deploy_file)
	const max_ram = ns.getServerMaxRam(hostname) - reserved_ram
	return Math.floor(max_ram / script_ram)
}

function GetHackFileForMode(request: HackModeRequest): string {
    if (request.hack_mode == HackMode.Custom) {
        if (request.file === undefined) throw Error("File must be defined for HackMode.Custom")
        return request.file
    }
    const ret = constants.hack_files.get(request.hack_mode)
    if (ret === undefined) throw Error(`Hack files map missing entry for mode: ${request.hack_mode}`)
    return ret
}

function InitializeRemoteFiles(ns: NS, hostname: string, files: string[]) {
    let to_copy: string[] = []
    for (const file of files) {
        to_copy.push(file)
    }
    ns.scp(to_copy, hostname)
}

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

// Bot class
class Bot {

    protected _host: Host
    protected _has_root: boolean
    protected _ns: NS

    // TODO: Just drop to use hack mode info presence for hack running check
    protected _hack_running: boolean
    protected _active_hack_info?: ActiveHackModeInfo

    // Get root if needed, send all files if needed, delete any files not needed, collect state of 
    // any running processes 
    constructor(ns: NS, host: Host) {
        this._ns = ns
        this._host = host
        this._has_root = maybeGetRoot(ns, host.id)
        this._ns.scp(constants.known_files, this._host.id)
        this._hack_running = false
        this._active_hack_info = undefined
    }

    public killall() {
        this._ns.killall(this._host.id, true)
        this._hack_running = false
    }

    public stopHack() {
        if (this._hack_running && this._active_hack_info) {
            this._ns.kill(this._active_hack_info.pid)
            this._hack_running = false
        }
    }

    // Functions that can be overridden for home bot
    protected _compute_max_threads(file: string) {
        return ComputeThreads(this._ns, this._host.id, file)
    }
    protected _run_hack_file(file: string, threads: number, target: string): number {
        return this._ns.exec(file, this._host.id, threads, target)
    }

    // Functions that the bot provides
    public startHack(request: HackModeRequest): boolean {
        if (this._hack_running) return true
        if (!this._has_root) return false

        // Verify file is present
        const file = GetHackFileForMode(request)
        if (this._ns.ls(this._host.id, file).length === 0) throw Error(`${this._host.id} missing file ${file}`)

        // Determine how many threads to use
        const max_threads = this._compute_max_threads(file)
        let use_threads = max_threads
        if (max_threads <= 0) return false
        // This was causing issues with purchased servers after upgrade. Either fix this or remove 
        // thread specification for now
        // if (request.threads !== undefined) use_threads = Math.min(request.threads, max_threads)
        
        // Run the file
        const pid = this._run_hack_file(file, use_threads, request.target)
        // this._ns.tprint(`Starting hack from ${this._host.id} with info ${request.hack_mode}. Expected file: ${file}. Threads: ${use_threads}` )

        // Verify it worked and update state
        if (pid === 0) throw Error(`Unable to start hack for ${this._host.id}`)
        this._hack_running = true
        this._active_hack_info = {
            hack_mode: request.hack_mode, 
            target: request.target, 
            threads: use_threads, 
            file: file, 
            pid: pid }
        return true

    }

    // Bot information
    public host(): Host { return this._host}
    public has_root(): boolean { return this._has_root}
    public hack_info(): ActiveHackModeInfo | undefined {return this._active_hack_info}
    public debug_string(): string {
        let out = ""
        out += `Host: ${this._host.id}\n`
        out += `  Root: ${this._has_root}\n`
        out += `  Connections: ${this._host.connections}\n`
        if (this._hack_running) {
            out += `  Hack: ${this._active_hack_info?.target}, n=${this._active_hack_info?.threads}, mode=${this._active_hack_info?.hack_mode}, pid=${this._active_hack_info?.pid}\n`
        }
        
        return out
    }

    public getHackInfo(): HackInfo {
        return {
            maxMoney: this._ns.getServerMaxMoney(this.host().id),
            curMoney: this._ns.getServerMoneyAvailable(this.host().id),
            minSecurity: this._ns.getServerMinSecurityLevel(this.host().id),
            curSecurity: this._ns.getServerSecurityLevel(this.host().id),
            reqHackLevel: this._ns.getServerRequiredHackingLevel(this.host().id),
        }
    }

    public ScoreHackQuality(): TargetRankingInfo {
        const hackInfo = this.getHackInfo()
        const myHackLevel = this._ns.getHackingLevel()
    
        const buildReturn = (score: number): TargetRankingInfo => {
            return {
                hostname: this.host().id,
                hackInfo: hackInfo,
                score: score
            }
        }
    
        const hackLevelThresh = myHackLevel / constants.server_ranking_divisor
        if (hackInfo.reqHackLevel > hackLevelThresh || !this.has_root()) return buildReturn(0)
        return buildReturn(hackInfo.maxMoney)
    
    }
    
}

class HomeBot extends Bot {
    protected _compute_max_threads(file: string) {
        return ComputeThreads(this._ns, this._host.id, file, constants.home_reserved_ram)
    }
    protected _run_hack_file(file: string, threads: number, target: string): number {
        return this._ns.run(file, threads, target)
    }
}

class Botnet {
    public bots: Bot[]
    private _ns: NS
    private _active_hack_request: HackModeRequest
    private _hack_running: boolean
    private _purchased_servers: Bot[]

    constructor(ns: NS) {
        this._ns = ns
        this.bots = []
        this._purchased_servers = []
        this._hack_running = false
        this._active_hack_request = {
            hack_mode: HackMode.MaxMoney,
            target: "joesguns",
            threads: undefined,
            file: undefined
        }
    }

    public hack_manual(target: string) {
        const request = {
            hack_mode: HackMode.MaxMoney,
            target: target,
            threads: undefined,
            file: undefined
        }
        this._hack_running = true
        this._start_hack(request)
    }

    public hack_auto() {
        const best_target = this._SelectBestTarget()
        const request = {
            hack_mode: HackMode.MaxMoney,
            target: best_target,
            threads: undefined,
            file: undefined
        }
        this._hack_running = true
        this._start_hack(request)
    }

    private _start_hack(request: HackModeRequest) {
        this._active_hack_request = request
        for (const bot of this.bots) {
            bot.startHack(request)
        }
        for (const bot of this._purchased_servers) {
            bot.startHack(request)
        }
    }

    public print() {
        for (const bot of this.bots) {
            this._ns.tprint(bot.debug_string())
        }
    }
    public hosts() {
        let hosts = []
        for (const bot of this.bots) {
            hosts.push(bot.host())
        }
        return hosts
    }

    // TODO: Modify/add summary to handle purchased servers
    public print_summary() {
        const total_hosts = this.bots.length
        let with_root = 0
        let with_memory = 0
        let active_bots = 0
        let total_threads = 0
        const hack_file = constants.hack_files.get(HackMode.MaxMoney)
        if (!hack_file) return
        for (const bot of this.bots) {
            if (bot.has_root()) { with_root += 1}
            const hack_info = bot.hack_info()
            if (hack_info) {
                active_bots += 1
                total_threads += hack_info.threads
            }
            if (ComputeThreads(this._ns, bot.host().id, hack_file) > 0) {
                with_memory += 1
            }
        }

        this._ns.tprint(`Botnet status`)
        this._ns.tprint(`Root: ${with_root}/${total_hosts}, Botable: ${with_memory}/${total_hosts}, Active bots: ${active_bots} (n=${total_threads})`)
    }

    public print_hosts() {
        for (const bot of this.bots) {
            this._ns.tprint(bot.host().id)
        }
    }

    public killall() {
        for (const bot of this.bots) {
            bot.killall()
        }
        this._hack_running = false
    }

    public RefreshPurchasedServers() {
        // Stop/delete existing servers
        for (const bot of this._purchased_servers) {
            bot.killall()
        }

        // Clear bot list 
        this._purchased_servers = []

        // Recreate bots
        const current_servers = this._ns.getPurchasedServers()
        for (const name of current_servers) {
            this._purchased_servers.push(new Bot(this._ns, {id: name, connections: []}))
        }

        // Restart hack
        if (this._hack_running) this._start_hack(this._active_hack_request)
    }

    private _SelectBestTarget(): string {
        let best_target = undefined
        let best_score = 0
        for (const bot of this.bots) {
            const score_results = bot.ScoreHackQuality()
            if (score_results.score > best_score) {
                best_target = score_results
                best_score = score_results.score
            }
        }
        if(best_target === undefined) throw Error("Could not find any valid targets")

        this._ns.tprint(`Best target ${best_target.hostname} - ${best_target.score} {level_req: ${best_target.hackInfo.reqHackLevel}, max_money: ${best_target.hackInfo.maxMoney}}`)
        return best_target.hostname
    }
}


function BringupBotnet(ns: NS): Botnet {

    const max_depth = 20
    const home_host: Host = {id: "home", connections: ns.scan("home")}
    let local_hosts = crawl3(ns, home_host, 0, [], max_depth)
    local_hosts.push(home_host)


    let net = new Botnet(ns)
    for (const crawl_info of local_hosts) {
        const connections = ns.scan(crawl_info.id)
        if (crawl_info.id === "home") {
            net.bots.push(new HomeBot(ns, {id: crawl_info.id, connections: connections}))
        } else {
            net.bots.push(new Bot(ns, {id: crawl_info.id, connections: connections}))
        }
    }

    ns.tprint(`Found ${net.bots.length} hosts from bootstrap`)

    return net
}

class SimpleCounterTimer {
    private reset_count: number
    private count: number

    public constructor(trigger_time: number, sleep_time: number, trigger_on_construct: boolean) {
        this.count = 0
        this.reset_count = trigger_time / sleep_time
        if (trigger_on_construct) {
            this.count = this.reset_count
        }
    }

    public check_trigger(): boolean {
        this.count += 1
        if (this.count >= this.reset_count) {
            this.count = 0
            return true
        }
        return false
    }
}

function handleServers(ns: NS, botnet: Botnet) {
    const purchase_made = buyAndUpgradeServers(ns, constants.min_purchase_server_ram, constants.purchase_cost_fraction)
    if (purchase_made) {
        ns.tprint(`Purchased or upgraded servers, relaunching net..`)
        botnet.RefreshPurchasedServers()
        ns.tprint("Done")
    }    
}

function findCodingContracts(ns: NS, hosts: Host[]) {
    let out_str = ""
    let count = 0
    for (const host of hosts) {
        const filenames = ns.ls(host.id, ".cct")
        for (const file of filenames) {
            out_str += host.id + ":" + file + "\n"
            count += 1
        }
    }
    if (count > 0) {
        ns.tprint(`Found ${count} coding contracts`)
        ns.write("contracts.txt", out_str, "w")
    } else {
        ns.tprint("No coding contracts found.")
    }
}

/** @param {NS} ns */
export async function main(ns: NS) {


    ns.tprint("Server v2 starting!")

    let botnet = BringupBotnet(ns)
    ns.tprint("Botnet Bootstrap Complete!")
    

    ns.tprint("Killing all bot activity")
    botnet.killall()

    // botnet.hack_auto()
    botnet.hack_manual("joesguns")
    ns.tprint("Botnet hacking started")

    // botnet.print()
    // botnet.print_hosts()
    botnet.print_summary()

    ns.tprint("Server running")
    let periodic_trigger = new SimpleCounterTimer(
        constants.periodic_check_time, 
        constants.server_sleep_time, true
    )

    while(true) {

        if (periodic_trigger.check_trigger()) {
            ns.tprint("Triggered periodic server check")
            handleServers(ns, botnet)
            buyAndUpgradeAllHacknetNodes(ns, constants.purchase_cost_fraction)
            botnet.print_summary()

            findCodingContracts(ns, botnet.hosts())

        }
        await ns.sleep(constants.server_sleep_time);
    }

}