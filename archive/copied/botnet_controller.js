import * as botnetlib from 'botnet/botnetlib'

// Global config
const target = "omega-net"
const prefix = "botnet"
const deploy_file = prefix + "v0.js"
const crawl_distance = 10
const home_reserved_ram = 32
const comm_port = 5

// Helper functions

function GetAllHostnames(ns) {
	return botnetlib.crawl(ns, "home", 0, [], crawl_distance)
}

function getCurrentBots(ns) {
	const all_hostnames = GetAllHostnames(ns)
	let bot_hostnames = []
	for (const hostname of all_hostnames) {
		if (hostname === "home") continue
		const files = ns.ls(hostname, prefix)
		if (files.length > 0) bot_hostnames.push(hostname)
	}
	return bot_hostnames
}

function getPotentialBots(ns) {
	const all_hostnames = GetAllHostnames(ns)
	let potential_bot_hostnames = []
	const max_ports_hackable = botnetlib.maxNumPortsHackable(ns)
	for (const hostname of all_hostnames) {
		if (hostname === "home") continue
		if (botnetlib.canBotnet(ns, hostname, max_ports_hackable)) potential_bot_hostnames.push(hostname)
	}
	return potential_bot_hostnames
}

function ComputeThreads(ns, hostname, deploy_file, reserved_ram=0) {
	const script_ram = ns.getScriptRam(deploy_file)
	const max_ram = ns.getServerMaxRam(hostname) - reserved_ram
	return Math.floor(max_ram / script_ram)
}


// Bot functions

function StopBot(ns, hostname) {
	const files = ns.ls(hostname, prefix)
	files.map((file) => ns.scriptKill(file, hostname))
	ns.tprint(`Stopped bot ${hostname}`)
}

function StartBot(ns, hostname, target, deploy_file) {
	if (!ns.fileExists(deploy_file, hostname)) {
		throw Error(`File ${deploy_file} does not exist on ${hostname}`)
	}
	const n_threads = ComputeThreads(ns, hostname, deploy_file)
	ns.exec(deploy_file, hostname, n_threads, target)
	ns.tprint(`Started ${hostname} with ${n_threads} threads`)
}

function CleanBot(ns, hostname) {
	StopBot(ns, hostname)
	const files = ns.ls(hostname, prefix)
	files.map((file) => ns.rm(file, hostname))
	ns.rm("early-hack-template.script", hostname)
	ns.tprint(`Cleaned ${hostname}`)
}

function UpdateTargetBot(ns, hostname, target, deploy_file) {
	StopBot(ns, hostname)
	StartBot(ns, hostname, target, deploy_file)
	ns.tprint(`Updated target on ${hostname} to ${target}`)
}

async function DeployBot(ns, hostname, target, deploy_file) {
	const root_ok = botnetlib.maybeGetRoot(ns, hostname)
	if (!root_ok) {
		throw Error(`Could not get root access on ${hostname}`)
	}
	ns.tprint(`Root access OK on ${hostname}`)
	CleanBot(ns, hostname)
	const scp_ok = await ns.scp(deploy_file, hostname)
	if (!scp_ok) {
		throw Error(`Could not scp ${deploy_file} to ${hostname}`)
	}
	ns.tprint(`SCPd ${deploy_file} to ${hostname}`)
	StartBot(ns, hostname, target, deploy_file)
}

function StopHome(ns, deploy_file) {
	ns.scriptKill(deploy_file, "home")
	ns.tprint(`Stopped bot home`)
}

function StartHome(ns, target, deploy_file) {
	if (!ns.fileExists(deploy_file, "home")) {
		throw Error(`File ${deploy_file} does not exist on home`)
	}
	const n_threads = ComputeThreads(ns, "home", deploy_file, home_reserved_ram)
	ns.run(deploy_file, n_threads, target)
	ns.tprint(`Started home with ${n_threads} threads`)
}


// Net functions

function StopNet(ns, deploy_file) {
	ns.tprint("Stopping botnet...")
	const bots = getCurrentBots(ns)
	bots.forEach((hostname) => StopBot(ns, hostname))
	StopHome(ns, deploy_file)
	ns.tprint("Done")
}

function StartNet(ns, target, deploy_file) {
	ns.tprint(`Starting botnet with ${deploy_file} against ${target}...`)
	const bots = getCurrentBots(ns)
	bots.forEach((hostname) => StartBot(ns, hostname, target, deploy_file))
	StartHome(ns, target, deploy_file)
	ns.tprint("Done")
}

function CleanNet(ns) {
	ns.tprint("Cleaning botnet...")
	const bots = getCurrentBots(ns)
	bots.forEach((hostname) => CleanBot(ns, hostname))
	ns.tprint("Done")
}

function UpdateTargetNet(ns, target, deploy_file) {
	ns.tprint(`Updating botnet to target ${target}...`)
	const bots = getCurrentBots(ns)
	bots.forEach((hostname) => UpdateTargetBot(ns, hostname, target, deploy_file))
	ns.tprint("Done")
}

async function DeployNet(ns, target, deploy_file) {
	const potential_bots = getPotentialBots(ns)
	ns.tprint("Potential bots:")
	potential_bots.forEach((hostname) => ns.tprint(`  ${hostname}`))
	// const resp = await ns.prompt("Okay to deploy?",)
	// if (resp === false) {
	// 	ns.tprint("Aborted")
	// 	return
	// }

	ns.tprint(`Deploying botnet with ${deploy_file} against ${target}...`)
	for (const hostname of potential_bots) {
		await DeployBot(ns, hostname, target, deploy_file)
	}
	StartHome(ns, target, deploy_file)
	ns.tprint("Done")
}

function ShowStatusNet(ns) {
	ns.tprint("Botnet Status")
	ns.tprint(` Current target: ${target}`)
	ns.tprint(` Current deploy file: ${deploy_file}`)
	const bots = getCurrentBots(ns)
	ns.tprint(" Current bots:")
	bots.forEach((hostname) => ns.tprint(`   ${hostname}`))
}

function ShowPredeploy(ns) {
	ns.tprint("Potential bots:")
	const potential_bots = getPotentialBots(ns)
	potential_bots.forEach((hostname) => ns.tprint(`  ${hostname}`))
}





/** @param {NS} ns */
export async function main(ns) {

	if (ns.args.length == 0) {
		throw Error("Must provide at least one argument as a command")
	}
	const command = ns.args[0]
	// let pass_args = []
	// if (args.length > 1) {
	// 	pass_args = args.slice(1)
	// }

	switch (command) {
		case "stop":
			StopNet(ns, deploy_file)
			break
		case "start":
			StartNet(ns, target, deploy_file)
			break
		case "clean":
			CleanNet(ns)
			break
		case "deploy":
			await DeployNet(ns, target, deploy_file)
			break
		case "target":
			UpdateTargetNet(ns, target, deploy_file)
			break
		case "status":
			ShowStatusNet(ns)
			break
		case "predeploy":
			ShowPredeploy(ns)
			break
		case "starthome":
			StartHome(ns, target, deploy_file)
			break
		case "stophome":
			StopHome(ns, deploy_file)
			break
	}

}