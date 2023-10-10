import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns: NS) {

	// Get target from first arg
	const target = ns.args[0]
	if (typeof target !== "string") throw Error(`Argument ${target} must be a string`)
	ns.print(`Starting botnet to target ${target}`)

	// Defines how much money a server should have before we hack it
	// In this case, it is set to 75% of the server's max money
	const moneyThresh = ns.getServerMaxMoney(target) * 0.75;

	// Defines the maximum security level the target server can
	// have. If the target's security level is higher than this,
	// we'll weaken it before doing anything else
	const securityThresh = ns.getServerMinSecurityLevel(target);
	
	// Infinite loop that continuously hacks/grows/weakens the target server
	while(true) {
		if (ns.getServerSecurityLevel(target) > securityThresh) {
			await ns.weaken(target);
		} else  {
			await ns.grow(target);
		}
	}
}