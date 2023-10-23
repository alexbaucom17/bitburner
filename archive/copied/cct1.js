import {printDetails} from cctlib

function totalWaysToSumFastHelper(ns, value, cache) {
	if (value in cache) return cache[value]
	let all_ways = 0
	for (let i = 1; i < value; i++) {
		const t_i = totalWaysToSumFastHelper(ns, i, cache)
		all_ways += Math.max(t_i, 1)
	}
	cache[value] = all_ways
	return all_ways
}

function totalWaysToSumFast(ns, input) {
	let cache = {1: 0, 2: 1}
	const total = totalWaysToSumFastHelper(ns, input, cache)
	ns.tprint(cache)
	return total
}


class ObjectSet extends Set{
  add(elem){
    return super.add(typeof elem === 'object' ? JSON.stringify(elem) : elem);
  }
  has(elem){
    return super.has(typeof elem === 'object' ? JSON.stringify(elem) : elem);
  }
  *[Symbol.iterator]() {
	 for (let item of super[Symbol.iterator]()) {
		yield JSON.parse(item)
    }
  }
}


function totalWaysToSumHelper(ns, value, cache) {
	if (value === 1) return [[1]]
	if (value in cache) return cache[value]
	let all_ways = new ObjectSet()
	for (let i = 1; i < value; i++) {
		const j = value - i
		const t1 = totalWaysToSumHelper(ns, i, cache)
		const t2 = totalWaysToSumHelper(ns, j, cache)
		for (const t11 of t1) {
			for (const t22 of t2) {
				const s = t11.concat(t22).sort()
				all_ways.add(s)
			}
		}
	}
	all_ways.add([value])
	cache[value] = all_ways
	return all_ways
}

function totalWaysToSum(ns, input) {
	let cache = {}
	const all_sums = totalWaysToSumHelper(ns, input, cache)
	ns.tprint([...all_sums])
	return all_sums.size - 1
}

/** @param {NS} ns */
export async function main(ns) {
	// printDetails(ns, "contract-931089.cct", "darkweb")
	const val = 5
	ns.tprint(`Total ways ${val}: ${totalWaysToSum(ns, val)}`)
	ns.tprint(`Total ways fast ${val}: ${totalWaysToSumFast(ns, val)}`)
}