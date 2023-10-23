export function printDetails(ns, filename, hostname) {
	const type = ns.codingcontract.getContractType(filename, hostname)
	const data = ns.codingcontract.getData(filename, hostname)
	const description = ns.codingcontract.getDescription(filename, hostname)

	ns.tprint("Contract details:")
	ns.tprint(`Type: ${type}`)
	ns.tprint(`Description: ${description}`)
	ns.tprint(`Data: ${data}`)
}