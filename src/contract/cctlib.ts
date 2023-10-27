import { NS } from "@ns";

export function printDetails(ns: NS, filename: string, hostname: string) {
	const type = ns.codingcontract.getContractType(filename, hostname)
	const data = ns.codingcontract.getData(filename, hostname)
	const description = ns.codingcontract.getDescription(filename, hostname)

	ns.tprint("Contract details:")
    ns.tprint(`Host: ${hostname}`)
    ns.tprint(`Filename: ${filename}`)
	ns.tprint(`Type: ${type}`)
	ns.tprint(`Description: ${description}`)
	ns.tprint(`Data: ${data}`)
}


/** @param {NS} ns */
export async function main(ns: NS) {

    const contract_info = "netlink:contract-425833.cct"
    const split_info = contract_info.split(":")
    const host = split_info[0]
    const filename = split_info[1]

    printDetails(ns, filename, host)

    if (ns.args.length > 0 && ns.args[0] === true) {
        const answer = 24
        ns.tprint("Submitting answer: " + answer)
        const result = ns.codingcontract.attempt(answer,filename, host)
        if (result) {
            ns.tprint(`Contract solved successfully! Reward: ${result}`)
        } else ns.tprint("Failed to solve contract.")
    }


}
