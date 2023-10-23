import { NS } from "@ns"

const backdoor_targets = [
    "CSEC",
    "I.I.I.I",
    "avmnite-02h",
    "run4theh111z"
]

// function ShowBackdoorSteps(ns: NS, info: CrawlInfo) {
//     ns.tprint(`${info.hostname}:`)
//     if (info.path.length < 10) {
//         ns.tprint(`scan-analyze 10 | ${info.hostname} | backdoor`)
//     } else {
//         const intermediate = info.path.at(9)
//         ns.tprint(`scan-analyze 10 | ${intermediate} | scan-analyze 10 | ${info.hostname} | backdoor`)
//     }
//     ns.tprint("\n")
// }

// /** @param {NS} ns */
// export async function main(ns: NS) {

//     const crawl_info = await PerformFullScan(ns)
//     for (const target of backdoor_targets) {
//         let found = false
//         for (const info of crawl_info) {
//             if (target === info.hostname) {
//                 ShowBackdoorSteps(ns, info)
//                 found = true
//             }
//         }
//         if (!found) throw Error(`Could not find path to ${target}`)
//     }
// }