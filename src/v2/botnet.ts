import { NS, ProcessInfo } from "@ns";
import { mode, known_files, scan_deploy_file, hack_files } from "v2/constants2";
import * as constants from "v2/constants2"
import {Host, BotMode, HackMode, HackModeRequest, ScanModeInfo, BotModeInfo, ActiveHackModeInfo} from "v2/interfaces";
import { crawl2, CrawlInfo } from "/scannet/scanlib";

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

export function GetHackFileForMode(request: HackModeRequest): string {
    if (request.hack_mode == HackMode.Custom) {
        if (request.file === undefined) throw Error("File must be defined for HackMode.Custom")
        return request.file
    }
    const ret = hack_files.get(request.hack_mode)
    if (ret === undefined) throw Error(`Hack files map missing entry for mode: ${request.hack_mode}`)
    return ret
}

function InitializeRemoteFiles(ns: NS, hostname: string, files: string[]) {
    let to_copy: string[] = []
    for (const file of files) {
        if (ns.ls(hostname, file).length === 0) to_copy.push(file)
    }
    ns.scp(to_copy, hostname)
}

function CollectActiveModes(ns: NS, host: Host) : ActiveHackModeInfo[] {
    const active_processes = ns.ps(host.id)
    let active_modes: ActiveHackModeInfo[] = []
    for (const process of active_processes) {
        if (!known_files.includes(process.filename)) {
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

    // Get root if needed, send all files if needed, delete any files not needed, collect state of 
    // any running processes 
    constructor(ns: NS, host: Host) {
        this._ns = ns
        this._host = host
        this._has_root = maybeGetRoot(ns, host.id)
        this._active_modes = [] //CollectActiveModes(this._ns, this._host)
        if (this._has_root) {
            this._supported_modes = GenerateSupportedModes(this._ns, this._host)
        } else {
            this._supported_modes = []
        }
        InitializeRemoteFiles(ns, this._host.id, known_files)
    }

    public executeMode(mode_info: BotModeInfo): boolean {
        if(!this._supported_modes.includes(mode_info.mode)) return false

        switch(mode_info.mode) {
            case BotMode.Hack:
                if (mode_info.hack_info === undefined) throw Error("Missing hack mode info")

                const active_mode = this.startHack(mode_info.hack_info)
                if (active_mode) this._active_modes.push(active_mode) 

                return true

            case BotMode.Scan:
                if (mode_info.scan_info === undefined) throw Error("Missing scan mode info")

                this.scan(mode_info.scan_info)
                return true
            
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
        }
    }

    public killall() {
        this._ns.killall(this._host.id, true)
    }

    // Functions that the bot provides
    protected startHack(request: HackModeRequest): ActiveHackModeInfo | null {
        const file = GetHackFileForMode(request)
        if (this._ns.ls(this._host.id, file).length === 0) throw Error(`${this._host.id} missing file ${file}`)
        const max_threads = ComputeThreads(this._ns, this._host.id, file)
        let use_threads = max_threads
        if (max_threads === 0) return null
        if (request.threads !== undefined) use_threads = Math.min(request.threads, max_threads)
        // this._ns.tprint(`Starting hack from ${this._host.id} with info ${info.hack_mode}. Expected file: ${file}. Threads: ${use_threads}` )
        const pid = this._ns.exec(file, this._host.id, use_threads, request.target)
        if (pid === 0) throw Error(`Unable to start hack for ${this._host.id}`)
        return {hack_mode: request.hack_mode, target: request.target, threads: use_threads, file: file, pid: pid}
    }
    protected scan(info: ScanModeInfo) {
        const hostname = this._host.id
        const available_ram = this._ns.getServerMaxRam(hostname) - this._ns.getServerUsedRam(hostname)
        const needed_ram = this._ns.getScriptRam(scan_deploy_file, hostname)
        if (available_ram < needed_ram) {
            if (info.prioritize) {
                this.stopMode(BotMode.Hack)
            } else {
                throw Error(`${hostname} only has ${available_ram} ram available but script needs ${needed_ram}`)
            }
        }
        this._ns.exec(scan_deploy_file, hostname, 1)
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
    protected startHack(request: HackModeRequest): ActiveHackModeInfo | null {
        const file = GetHackFileForMode(request)
        // this._ns.tprint(`Starting hack from ${this._host.id} with info ${info.hack_mode}. Expected file: ${file}` )
        const max_threads = ComputeThreads(this._ns, this._host.id, file, constants.home_reserved_ram)
        let use_threads = max_threads
        if (max_threads === 0) return null
        if (request.threads !== undefined) use_threads = Math.min(request.threads, max_threads)
        const pid = this._ns.run(file, use_threads, request.target)
        if (pid === 0) throw Error(`Unable to start hack for ${this._host.id}`)
        return {hack_mode: request.hack_mode, target: request.target, threads: use_threads, file: file, pid: pid}
    }
}

class Botnet {
    public bots: Bot[]
    private _ns: NS

    constructor(ns: NS) {
        this._ns = ns
        this.bots = []
    }

    public hack(target: string) {
        const info = {
            mode: BotMode.Hack,
            hack_info: {
                hack_mode: HackMode.MaxMoney,
                target: target,
                threads: undefined,
                file: undefined
            },
            scan_info: undefined
        }
        for (const bot of this.bots) {
            bot.executeMode(info)
        }
    }

    public print() {
        for (const bot of this.bots) {
            this._ns.tprint(bot.debug_string())
        }
    }

    public print_summary() {
        const total_hosts = this.bots.length
        let with_root = 0
        let with_memory = 0
        let active_bots = 0
        let total_threads = 0
        const hack_file = hack_files. get(HackMode.MaxMoney)
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
    }
}


async function BootstrapBotnet(ns: NS): Promise<Botnet> {

    const max_depth = 10
    let local_hosts = crawl2(ns, {hostname: "home", path: []}, 0, [], max_depth)
    local_hosts.push({hostname: "home", path: ["home"]})

    let net = new Botnet(ns)
    for (const crawl_info of local_hosts) {
        const connections = ns.scan(crawl_info.hostname)
        if (crawl_info.hostname === "home") {
            net.bots.push(new HomeBot(ns, {id: crawl_info.hostname, connections: connections}))
        } else {
            net.bots.push(new Bot(ns, {id: crawl_info.hostname, connections: connections}))
        }
    }
    return net
}

/** @param {NS} ns */
export async function main(ns: NS) {


    ns.tprint("Server v2 starting!")

    let botnet = await BootstrapBotnet(ns)
    ns.tprint("Botnet Bootstrap Complete!")

    ns.tprint("Killing all bot activity")
    botnet.killall()

    botnet.hack("joesguns")
    ns.tprint("Botnet hacking joesguns")

    // botnet.print()
    botnet.print_hosts()
    botnet.print_summary()

}