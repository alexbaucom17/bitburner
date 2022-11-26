import { NS } from "@ns";
import * as constants from "constants";
import {StopNet, CleanNet, DeployNet, ShowStatusNet, BotState, BotStateMap, CleanAll, SelectBestTarget, MaybePurchaseOrUpgradeServers} from "botnet/botnetlib";
import {PerformFullScan, GetAllHostnames} from "scannet/scanlib"

function GetCommData(ns: NS): string | number | null {
	let port = ns.getPortHandle(constants.comm_port)
	if (port.empty()) return null
	let data = port.read()
	return data
}

function FlushComms(ns: NS, port_number: number): void {
    let port = ns.getPortHandle(port_number)
    while(!port.empty()) port.read()
}

function SaveState(ns: NS, botnet_states: BotStateMap): void {
    let out_str = ""
    for (let [hostname, state] of botnet_states) {
        const line_str = `${hostname},${state.botnet_file},${state.target},${state.threads}\n`
        out_str = out_str.concat(line_str)
    }
    ns.write(constants.state_file, out_str, "w")
    ns.print(`Saved state to ${constants.state_file}`)
}

function LoadState(ns: NS, botnet_states: BotStateMap): void {
    const raw_data = ns.read(constants.state_file)
    if(!raw_data) {
        ns.print(`State file ${constants.state_file} does not exist or is empty, skipping state load.`)
        return
    }
    let lines = raw_data.split("\n")
    for (let line of lines){
        if(!line) continue
        let data = line.split(",")
        if(data.length != 4) throw Error(`Load state failed to process data: ${line}`)
        const hostname = data[0]
        const botnet_file = data[1]
        const target = data[2]
        const threads = parseInt(data[3])
        botnet_states.set(hostname, {target: target, botnet_file: botnet_file, threads: threads})
    }
    ns.print(`Loaded ${botnet_states.size} states from ${constants.state_file}`)
}

function ExtractCurTarget(botnet_states: BotStateMap): string {
    let cur_target = ""
    if(botnet_states.size > 0) {
        for(let [hostname, state] of botnet_states) {
            cur_target = state.target
            break
        }
    }
    return cur_target
}

async function RunCommands(ns: NS, botnet_states: BotStateMap, command: string, args: string[]): Promise<void> {
    ns.print(`Running command: ${command}, with args: ${args}`)
    switch (command) {
		case "stop":
			StopNet(ns, botnet_states)
			break
		case "clean":
			CleanNet(ns, botnet_states)
            SaveState(ns, botnet_states)
			break
		case "deploy":
            const target = SelectBestTarget(ns)
			await DeployNet(ns, botnet_states, target, constants.deploy_file)
            SaveState(ns, botnet_states)
			break
		case "status":
			ShowStatusNet(ns, botnet_states)
			break
        case "cleanall":
            CleanAll(ns, args[0])
            botnet_states.clear()
            SaveState(ns, botnet_states)
    }
}

async function GetAndRunCommands(ns: NS, botnet_states: BotStateMap): Promise<void> {
    const comm_data = GetCommData(ns);
    if (comm_data !== null) {
        if (typeof comm_data === "number") {
            ns.print(`Ignoring raw number data: ${comm_data}`)
            return;
        }
        let split_data = comm_data.split(" ")
        if (split_data.length === 0) {
            ns.print(`WARNING: Received empty comm_data: ${comm_data}`)
        }
        let command = ""
        let args: string[] = []
        if (split_data.length === 1) {
            command = split_data[0]
            args = []
        } else {
            command = split_data[0]
            args = split_data.slice(1)
        }
        await RunCommands(ns, botnet_states, command, args)
    }
}

class SimpleCounterTimer {
    private reset_count: number
    private count: number

    public constructor(trigger_time: number, sleep_time: number) {
        this.count = 0
        this.reset_count = trigger_time / sleep_time
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


/** @param {NS} ns */
export async function main(ns: NS) {

    ns.disableLog("sleep")
    ns.disableLog("scan")

    FlushComms(ns, constants.comm_port)
    FlushComms(ns, constants.scan_data_port)

    await PerformFullScan(ns)

    let botnet_states = new Map<string, BotState>();
    LoadState(ns, botnet_states)

    const server_sleep_time = 100
    let state_write_trigger = new SimpleCounterTimer(constants.write_state_time, server_sleep_time)
    let rank_target_trigger = new SimpleCounterTimer(constants.rank_target_time, server_sleep_time)
    let purchase_server_trigger = new SimpleCounterTimer(constants.purchase_server_time, server_sleep_time)

    ns.tprint("Server running")
    while(true) {
        await GetAndRunCommands(ns, botnet_states);

        if(state_write_trigger.check_trigger()) {
            SaveState(ns, botnet_states)
        }

        if(purchase_server_trigger.check_trigger()) {
            const purchase_made = MaybePurchaseOrUpgradeServers(ns)
            if (purchase_made) {
                const cur_target = ExtractCurTarget(botnet_states)
                if(cur_target) {
                    await DeployNet(ns, botnet_states, cur_target, constants.deploy_file)
                    SaveState(ns, botnet_states)
                }
            }
        }

        if(rank_target_trigger.check_trigger()) {
            const new_target = SelectBestTarget(ns)
            const cur_target = ExtractCurTarget(botnet_states)
            if(cur_target) {
                if (new_target !== cur_target) {
                    await DeployNet(ns, botnet_states, new_target, constants.deploy_file)
                    SaveState(ns, botnet_states)
                }
            }
        }
    
        await ns.sleep(server_sleep_time);
    }
}
