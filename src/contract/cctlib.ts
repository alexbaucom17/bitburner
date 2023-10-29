import { NS } from "@ns";

function printDetails(ns: NS, filename: string, hostname: string) {
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

function getAvailableContractsFromFile(ns: NS): string[] {
    const data = ns.read("contracts.txt")
    if (!data) throw Error("Missing contracts.txt file or no contracts found")
    const lines = data.split("\n")
    return lines
}

// Algorithmic Stock Trader I
function stock_trader_1(data: number[]): number {
    let max_diff = 0
    for (let i = 0; i < data.length-1; i++) {
        for (let j = i; j < data.length; j ++) {
            const diff = data[j] - data[i]
            if ( diff > max_diff) max_diff = diff
        }
    }
    return max_diff
}

function subarray_max_sum(data: number[]) {
    let max_sum = -100000
    for (let i = 0; i < data.length; i++) {
        let running_sum = 0
        for (let j = i; j < data.length; j++) {
            running_sum += data[j]
            if (running_sum > max_sum) max_sum = running_sum
        }
    }
    return max_sum
}

function maybeSolve(ns: NS, hostname: string, filename: string): boolean {
	const type = ns.codingcontract.getContractType(filename, hostname)
	const data = ns.codingcontract.getData(filename, hostname)

    let solution = null
    if (type === "Algorithmic Stock Trader I") {
        solution = stock_trader_1(data)
    } else if (type === "Subarray with Maximum Sum") {
        solution = subarray_max_sum(data)
    } else {
        return false
    }

    const result = ns.codingcontract.attempt(solution, filename, hostname)
    if (result) {
        ns.tprint(`Contract ${filename} (${type}) solved successfully! Reward: ${result}`)
    } else {
        printDetails(ns, filename, hostname)
        throw Error(`Failed to solve contract as expected. Given answer: ${solution}. Attempts remaining: ${ns.codingcontract.getNumTriesRemaining(filename, hostname)}`)
    }
    return true
}

function solveAuto(ns: NS) {
    const all_contracts = getAvailableContractsFromFile(ns)
    let num_found = all_contracts.length
    let missing = 0
    let skipped = 0
    let solved = 0
    for (const str of all_contracts) {
        const split_info = str.split(":")
        const host = split_info[0]
        const filename = split_info[1]
        if (!host || !filename || ns.ls(host, filename).length === 0) {
            missing += 1
            continue
        }
        const result = maybeSolve(ns, host, filename)
        if (result) solved += 1
        else skipped += 1
    }
    ns.tprint(`Found ${num_found} contracts. Solved: ${solved}, Skipped: ${skipped}, Missing: ${missing}`)
}


/** @param {NS} ns */
export async function main(ns: NS) {

    // Default info
    let contract_info = "netlink:contract-425833.cct"

    // Handle args for solving and indexing
    let solve = false
    let auto = false
    let ix = -1
    if (ns.args.length > 0) {
        for (const arg of ns.args) {
            if (arg === "solve") {
                solve = true
            }
            else if (typeof(arg) === "number") {
                ix = arg
            }
            else if (arg === "auto") {
                auto = true
            }
        }
    }

    if (auto) {
        solveAuto(ns)
    } else {

        // Try to read from contracts list 
        if (ix !== -1) {
            const lines = getAvailableContractsFromFile(ns)
            if (lines.length < ix) throw Error(`Invalid ix: ${ix} out of bounds for num contracts: ${lines.length}`)
            contract_info = lines[ix]
        }

        const split_info = contract_info.split(":")
        const host = split_info[0]
        const filename = split_info[1]

        printDetails(ns, filename, host)

        if (solve) {
            const answer = 18
            ns.tprint("Submitting answer: " + answer)
            const result = ns.codingcontract.attempt(answer,filename, host)
            if (result) {
                ns.tprint(`Contract solved successfully! Reward: ${result}`)
            } else ns.tprint("Failed to solve contract.")
        }
    }
}
