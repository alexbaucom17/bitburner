/** @param {NS} ns */
export async function main(ns) {

	// Get target from first arg
	const target = ns.args[0]
	ns.print(`Starting botnet to target ${target}`)

	// Defines how much money a server should have before we hack it
	// In this case, it is set to 75% of the server's max money
	const moneyThresh = ns.getServerMaxMoney(target) * 0.75;

	// Defines the maximum security level the target server can
	// have. If the target's security level is higher than this,
	// we'll weaken it before doing anything else
	const securityThresh = ns.getServerMinSecurityLevel(target) + 5;
	
	// Infinite loop that continously hacks/grows/weakens the target server
	while(true) {
		if (ns.getServerSecurityLevel(target) > securityThresh) {
			// If the server's security level is above our threshold, weaken it
			ns.print(`Security level ${ns.getServerSecurityLevel(target)} > thresh ${securityThresh}. Running weaken.`)
			await ns.weaken(target);
		} else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
			// If the server's money is less than our threshold, grow it
			ns.print(`Money available ${ns.getServerMoneyAvailable(target)} < thresh ${moneyThresh}. Running grow.`)
			await ns.grow(target);
		} else {
			// Otherwise, hack it
			await ns.hack(target);
		}
	}
}