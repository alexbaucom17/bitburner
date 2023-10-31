import { NS } from "@ns";

// Solutions

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

// Algorithmic Stock Trader II
function stock_trader_2(data: number[]): number {
    let total_diff = 0
    for (let i = 0; i < data.length -1; i++) {
        const diff = data[i+1] - data[i]
        if (diff > 0) total_diff += diff
    }
    return total_diff
}

// Algorithmic Stock Trader III
function stock_trader_3(data: number[]): number {
    let max_sum = stock_trader_1(data)
    for (let split_ix = 1; split_ix < data.length-1; split_ix++) {
        const front = data.slice(0, split_ix)
        const back = data.slice(split_ix)
        const p1 = stock_trader_1(front)
        const p2 = stock_trader_1(back)
        const total = p1 + p2
        if (total > max_sum) max_sum = total
    }
    return max_sum
}

// Subarray with Maximum Sum
function subarray_max_sum(data: number[]): number {
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

// Find Largest Prime Factor
function largest_prime_factor(input: number): number {
    let data = input
    while (true) {
        const result = primeOrDivisor(data)
        if (result.is_prime) return result.value
        else data = data / result.value
    }
}
interface primeOrDivisorResult {
    is_prime: boolean
    value: number
}
function primeOrDivisor(input: number): primeOrDivisorResult {
    for (let i = 2; i < Math.floor(input/2.0); i++) {
        if (input % i === 0) {
            return {is_prime: false, value: i}
        }
    }
    return {is_prime: true, value: input}
}

// Array Jumping Game
function array_jump_dfs(data: number[]): number {
    interface node {
        ix: number
        num_steps: number
    }

    let to_check: node[] = [{ix: 0, num_steps: 0}]
    let checked = new Set()
    while (to_check.length > 0) {
        const cur_node = to_check.pop()
        if (cur_node === undefined) continue
        // ns.tprint(`Checking node: ${cur_node.ix}, ${cur_node.num_steps}`)
        const ix = cur_node.ix
        if (checked.has(ix)) continue
        const val = data[ix]
        // ns.tprint(`Value: ${val}`)
        if (ix + val >= data.length) return cur_node.num_steps + 1
        for (let j = 1; j <= val; j++) {
            to_check.push({ix: ix + j, num_steps: cur_node.num_steps+1})
        }
        checked.add(ix)
    }
    return 0
}

function array_jumping_game(data: number[]): number {
    const num_steps = array_jump_dfs(data)
    if (num_steps !== 0) return 1
    return 0
}

// Array Jumping Game II
function array_jumping_game_2(data: number[]): number {
    return array_jump_dfs(data)
}

// Unique Paths in a Grid I
// function unique_paths_grid_1(data: number[]) : number {
//     const rows = data[0]
//     const cols = data[1]
//     const choices = (rows - 1) + (cols - 1)
//     const paths = Math.pow(2, choices)
//     return paths
// }


// Utilities

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

function maybeSolve(ns: NS, hostname: string, filename: string): boolean {
	const type = ns.codingcontract.getContractType(filename, hostname)
	const data = ns.codingcontract.getData(filename, hostname)

    let solution = null
    if (type === "Algorithmic Stock Trader I") {
        solution = stock_trader_1(data)
    } else if (type === "Algorithmic Stock Trader II") {
        solution = stock_trader_2(data)
    } else if (type === "Algorithmic Stock Trader III") {
        solution = stock_trader_3(data)
    } else if (type === "Subarray with Maximum Sum") {
        solution = subarray_max_sum(data)
    } else if (type === "Find Largest Prime Factor") {
        solution = largest_prime_factor(data)
    } else if (type === "Array Jumping Game") {
        solution = array_jumping_game(data)
    } else if (type === "Array Jumping Game II") {
        solution = array_jumping_game_2(data)
    // } else if (type === "Unique Paths in a Grid I") {
    //     solution = unique_paths_grid_1(data)
    } else {
        return false
    }

    const result = ns.codingcontract.attempt(solution, filename, hostname)
    if (result) {
        ns.tprint(`Contract ${filename} (${type}) solved successfully! Reward: ${result}`)
    } else {
        printDetails(ns, filename, hostname)
        ns.tprint(`Failed to solve contract ${filename} as expected. Given answer: ${solution}. Attempts remaining: ${ns.codingcontract.getNumTriesRemaining(filename, hostname)}`)
        throw Error("Failed to solve contract")
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

function testSolve(ns: NS) {
    const filename = "contract-536691.cct"
    const hostname = "clarkinc"
    printDetails(ns, filename, hostname)
    const data = ns.codingcontract.getData(filename, hostname)
    // const solution = array_jumping_game_2(data, ns)
    // ns.tprint(`Solution: ${solution}`)
}


/** @param {NS} ns */
export async function main(ns: NS) {

    // Default info
    let contract_info = "netlink:contract-425833.cct"

    // Handle args for solving and indexing
    let solve = false
    let auto = false
    let test = false
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
            } else if (arg === "test") {
                test = true
            }
        }
    }

    if (auto) {
        solveAuto(ns)
    } else if (test) {
        if (ix === -1) {
            testSolve(ns)
        } else {
            const lines = getAvailableContractsFromFile(ns)
            contract_info = lines[ix]
            const split_info = contract_info.split(":")
            const host = split_info[0]
            const filename = split_info[1]
            printDetails(ns, filename, host)
            maybeSolve(ns, host, filename)
        }
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
