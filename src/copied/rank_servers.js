import * as botnetlib from './botnetlib.js'

const crawl_distance = 10

function ScoreHost(ns, hostname) {
	const hackInfo = botnetlib.getHackInfo(ns, hostname)
	const myHackLevel = ns.getHackingLevel()

	const buildReturn = (score) => {
		return {
			hostname: hostname,
			hackInfo: hackInfo,
			score: score
		}
	}

	const hackLevelThresh = myHackLevel / 3
	if (hackInfo.reqHackLevel > hackLevelThresh) return buildReturn(0)
	return buildReturn(hackInfo.maxMoney)

}

/** @param {NS} ns */
export async function main(ns) {

	const all_hosts = botnetlib.crawl(ns, "home", 0, [], crawl_distance)
	let best = {hostname: "", score: 0, hackInfo: {}}
	for (const host of all_hosts) {
		const score_results = ScoreHost(ns, host)
		ns.tprint(`Scored ${score_results.hostname} - ${score_results.score} {level_req: ${score_results.hackInfo.reqHackLevel}, max_money: ${score_results.hackInfo.maxMoney}}`)
		if (score_results.score > best.score) {
			best = score_results
		}
	}
	ns.tprint(`Best target ${best.hostname} - ${best.score} {level_req: ${best.hackInfo.reqHackLevel}, max_money: ${best.hackInfo.maxMoney}}`)
}