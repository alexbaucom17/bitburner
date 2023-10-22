import { NS, ProcessInfo } from "@ns";
import * as constants from "v2/constants2"
import {Host, BotMode, HackMode, HackModeRequest, ScanModeInfo, BotModeInfo, ActiveHackModeInfo} from "v2/interfaces";
import {buyAndUpgradeAllHacknetNodes} from "systems/hacknet"
import {buyAndUpgradeServers} from "systems/server_purchase"
import {SelectBestTarget} from "botnet/botnetlib";

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
        // if (ns.ls(hostname, file).length === 0) to_copy.push(file)
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

function CollectActiveModes(ns: NS, host: Host) : ActiveHackModeInfo[] {
    const active_processes = ns.ps(host.id)
    let active_modes: ActiveHackModeInfo[] = []
    for (const process of active_processes) {
        if (!constants.known_files.includes(process.filename)) {
            throw Error(`Found unknown file ${process.filename} running on ${host.id}`)
        }
        if (typeof process.args[0] !== "string") throw Error(`Found unknown arg for process ${process.filename}: ${process.args[0]}`)

        // Recreate this as custom hack right now since I have all the info
        // TODO: Figure out a way to communicate the original mode, maybe as arg to the scrpit?
        active_modes.push(
            {
                hack_mode: HackMode.Custom,
                target: process.args[0],
                file: process.filename,
                threads: process.threads,
                pid: process.pid
            })
    }
    return active_modes
}

function GenerateSupportedModes(ns: NS, host: Host): BotMode[] {
    // For now just generate all modes
    return [BotMode.Hack, BotMode.Scan]
}


// Bot class
class Bot {

    protected _host: Host
    protected _has_root: boolean
    protected _supported_modes: BotMode[]
    protected _active_modes: ActiveHackModeInfo[]
    protected _ns: NS
    protected _hack_running: boolean

    // Get root if needed, send all files if needed, delete any files not needed, collect state of 
    // any running processes 
    constructor(ns: NS, host: Host) {
        this._ns = ns
        this._host = host
        this._has_root = maybeGetRoot(ns, host.id)
        this._hack_running = false
        this._active_modes = [] //CollectActiveModes(this._ns, this._host)
        if (this._has_root) {
            this._supported_modes = GenerateSupportedModes(this._ns, this._host)
        } else {
            this._supported_modes = []
        }
        InitializeRemoteFiles(ns, this._host.id, constants.known_files)
    }

    // TODO: Clean up mode execution and active modes. Seems like overkill for current use.
    public executeMode(mode_info: BotModeInfo): boolean {
        if(!this._supported_modes.includes(mode_info.mode)) return false

        switch(mode_info.mode) {
            case BotMode.Hack:
                if (mode_info.hack_info === undefined) throw Error("Missing hack mode info")
                if (this._hack_running) return true

                const active_mode = this.startHack(mode_info.hack_info)
                if (active_mode) {
                    this._active_modes.push(active_mode) 
                    return true
                }

                return false

            case BotMode.Scan:
                if (mode_info.scan_info === undefined) throw Error("Missing scan mode info")

                return this.scan(mode_info.scan_info)
            
            default:
                throw Error(`Unsupported mode ${mode_info.mode}`)
        }
    }

    public stopMode(mode: BotMode) {
        if (mode === BotMode.Hack){
            for (let i = this._active_modes.length - 1; i >= 0; i--) {
                this._ns.kill(this._active_modes[i].pid)
                this._active_modes.splice(i, 1)
            }
            this._hack_running = false
        }
    }

    public killall() {
        this._ns.killall(this._host.id, true)
        this._hack_running = false
    }

    // Functions that can be overridden for home bot
    protected _compute_max_threads(file: string) {
        return ComputeThreads(this._ns, this._host.id, file)
    }
    protected _run_hack_file(file: string, threads: number, target: string): number {
        return this._ns.exec(file, this._host.id, threads, target)
    }

    // Functions that the bot provides
    private startHack(request: HackModeRequest): ActiveHackModeInfo | null {
        const file = GetHackFileForMode(request)
        if (this._ns.ls(this._host.id, file).length === 0) throw Error(`${this._host.id} missing file ${file}`)
        const max_threads = this._compute_max_threads(file)
        let use_threads = max_threads
        if (max_threads === 0) return null
        if (request.threads !== undefined) use_threads = Math.min(request.threads, max_threads)
        // this._ns.tprint(`Starting hack from ${this._host.id} with info ${request.hack_mode}. Expected file: ${file}. Threads: ${use_threads}` )
        const pid = this._run_hack_file(file, use_threads, request.target)
        if (pid === 0) throw Error(`Unable to start hack for ${this._host.id}`)
        this._hack_running = true
        return {hack_mode: request.hack_mode, target: request.target, threads: use_threads, file: file, pid: pid}
    }
    private scan(info: ScanModeInfo): boolean {
        const hostname = this._host.id
        const available_ram = this._ns.getServerMaxRam(hostname) - this._ns.getServerUsedRam(hostname)
        const needed_ram = this._ns.getScriptRam(constants.scan_deploy_file, hostname)
        if (available_ram < needed_ram) {
            if (info.prioritize) {
                this.killall()
            } else {
                throw Error(`${hostname} only has ${available_ram} ram available but script needs ${needed_ram}`)
            }
        }
        const pid = this._ns.exec(constants.scan_deploy_file, hostname, 1)
        if (pid === 0) return false
        return true

    }

    // Bot information
    public host(): Host { return this._host}
    public has_root(): boolean { return this._has_root}
    public supported_modes(): BotMode[] { return this._supported_modes}
    public active_modes(): ActiveHackModeInfo[] { return this._active_modes}
    public debug_string(): string {
        let out = ""
        out += `Host: ${this._host.id}\n`
        out += `  Root: ${this._has_root}\n`
        out += `  Connections: ${this._host.connections}\n`
        out += "  Active modes:\n"
        for (const active_mode of this._active_modes) {
            out += `    ${active_mode.target}, n=${active_mode.threads}, mode=${active_mode.hack_mode}, pid=${active_mode.pid}\n`
        }
        return out
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
        const best_target = SelectBestTarget(this._ns, constants.BotnetMode.AUTO)
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
        const info = {
            mode: BotMode.Hack,
            hack_info: request,
            scan_info: undefined
        }
        this._active_hack_request = request
        for (const bot of this.bots) {
            bot.executeMode(info)
        }
        for (const bot of this._purchased_servers) {
            bot.executeMode(info)
        }
    }

    public print() {
        for (const bot of this.bots) {
            this._ns.tprint(bot.debug_string())
        }
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
            if (bot.active_modes().length > 0) {active_bots += 1}
            for (const mode of bot.active_modes()) {
                total_threads += mode.threads
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

    public is_bot(hostname: string): boolean {
        for (const bot of this.bots) {
            if (bot.host().id === hostname) return true
        }
        return false
    }

    public async full_scan() {
        let hosts_queue = []
        let port = this._ns.getPortHandle(constants.scan_data_port)
        for (const bot of this.bots){
            hosts_queue.push(bot.host().id)
        }
        while (hosts_queue.length > 0) {
            // Shift next item off the queue
            const host_to_scan = hosts_queue.shift()

            // Get bot object
            let cur_bot = null
            for (const bot of this.bots) {
                if (bot.host().id === host_to_scan) {
                    cur_bot = bot
                    break
                }
            }
            if (!cur_bot) throw Error(`Could not find matching bot ${host_to_scan}`)

            // Start scan
            const started = cur_bot.executeMode(
                {mode: BotMode.Scan, hack_info: undefined, scan_info: {prioritize: true}}
            )
            if (!started) {
                // this._ns.tprint(`Failed to start scan on ${host_to_scan}`)
                continue
            }

            // Collect results
            let wait_count = 0
            let scan_data: Host[] = []
            while (true) {
                const raw_data = port.read()
                if (raw_data === "NULL PORT DATA") {
                    await this._ns.sleep(100)
                    wait_count += 1
                    if(wait_count > 10) {
                        throw Error(`Failed to receive scan data from ${host_to_scan}`)
                    }
                } else {
                    scan_data = JSON.parse(raw_data.toString())
                    break
                }
            }

            // Determine if any new hosts were discovered
            let new_hosts = []
            for (const host of scan_data) {
                if (!this.is_bot(host.id)) new_hosts.push(host)
            }

            // Turn new hosts into bots and add them to the scan queue
            for (const new_host of new_hosts) {
                // this._ns.tprint(`Created new bot for ${new_host.id}`)
                this.bots.push(new Bot(this._ns, new_host))
                hosts_queue.push(new_host.id)
            }
        }
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
}


async function BringupBotnet(ns: NS): Promise<Botnet> {

    const max_depth = 10
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

    // Now use scanning to find the rest of the hosts
    ns.tprint("Starting full network scan...")
    await net.full_scan()
    ns.tprint(`Found ${net.bots.length} host after full scan`)

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

async function handleServers(ns: NS, botnet: Botnet) {
    const purchase_made = buyAndUpgradeServers(ns, constants.min_purchase_server_ram, constants.purchase_server_cost_fraction)
    if (purchase_made) {
        ns.tprint(`Purchased or upgraded servers, relaunching net..`)
        botnet.RefreshPurchasedServers()
        ns.tprint("Done")
    }    
}

/** @param {NS} ns */
export async function main(ns: NS) {


    ns.tprint("Server v2 starting!")

    let botnet = await BringupBotnet(ns)
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
    const server_sleep_time = 100
    let periodic_trigger = new SimpleCounterTimer(constants.buy_hacknets_time, server_sleep_time, true)
    while(true) {

        if (periodic_trigger.check_trigger()) {
            ns.tprint("Triggered periodic server check")
            handleServers(ns, botnet)
            buyAndUpgradeAllHacknetNodes(ns, constants.purchase_server_cost_fraction)
            botnet.print_summary()
        }
        await ns.sleep(server_sleep_time);
    }

}