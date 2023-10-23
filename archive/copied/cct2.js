import {printDetails} from "/ccts/cctlib"

function FindInflections(data) {
	let inflections = [data[0]]
	let dir = Math.sign(data[1] - data[0])
	for (let i = 1; i < data.length-1; i++) {
		const new_dir = Math.sign(data[i+1] - data[i])
		if (dir !== new_dir) {
			inflections.push(data[i])
			dir = new_dir
		}
	}
	inflections.push(data.slice(-1)[0])
	return inflections
}

function ComputeDeltas(inflections) {
	let deltas = []
	for (let i = 1; i < inflections.length; i++) {
		deltas.push(inflections[i] - inflections[i-1])
	}
	return deltas
}

function ComputeMaxFromDeltas(deltas) {
	let total = 0
	for (const d of deltas) {
		if (d > 0) total += d
	}
	return total
}

function AlgorithmicStockTrader(ns, data) {
	const inflections = FindInflections(data)
	ns.tprint(`Inflections: ${inflections}`)
	const deltas = ComputeDeltas(inflections)
	ns.tprint(`Deltas: ${deltas}`)
	const total = ComputeMaxFromDeltas(deltas)
	return total
} 

/** @param {NS} ns */
export async function main(ns) {
	const filename = "contract-931089.cct"
	const hostname = "darkweb"
	printDetails(ns, filename, hostname)
	const data = ns.codingcontract.getData(filename, hostname)
	const result = AlgorithmicStockTrader(ns, data)
	ns.tprint(result)
}