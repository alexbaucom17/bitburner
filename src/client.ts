import { NS, NetscriptPort } from "@ns";

const comm_port = 5

/** @param {NS} ns */
export async function main(ns: NS) {

	// Check arg length
    if (ns.args.length == 0) {
		throw Error("Must provide at least one argument as a command")
	}

    // Basic arg validation
    for (const arg of ns.args) {
        if (typeof arg !== "number" && typeof arg !== "string") {
            throw Error(`Invalid arg: ${arg}, must be a number or string`)
        }
    }

    // Join all args into string
    const arg_str = ns.args.join(" ")

    // Send arg string
    let port = ns.getPortHandle(comm_port)
    port.write(arg_str)

    // Print out command we sent
    ns.tprint(`Sent command: ${arg_str}`)
}
