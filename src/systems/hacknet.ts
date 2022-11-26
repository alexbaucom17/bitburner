import { NS } from "@ns";

const max_levels = 199
const max_ram = 6
const max_cores = 15
const max_money_frac = 0.01

function computeFullUpgradeCost(ns: NS, id: number): number {
    const core_upgrade_cost = ns.hacknet.getCoreUpgradeCost(id, max_cores)
    const ram_upgrade_cost = ns.hacknet.getRamUpgradeCost(id, max_ram)
    const level_upgrade_cost = ns.hacknet.getLevelUpgradeCost(id, max_levels)
    // ns.tprint(`core_upgrade_cost: ${core_upgrade_cost}, ram_upgrade_cost: ${ram_upgrade_cost}, level_upgrade_cost: ${level_upgrade_cost}`)
    return core_upgrade_cost + ram_upgrade_cost + level_upgrade_cost
}

function doFullUpgrade(ns: NS, id: number) {
    ns.hacknet.upgradeCore(id, max_cores)
    ns.hacknet.upgradeLevel(id, max_levels)
    ns.hacknet.upgradeRam(id, max_ram)
}

function maybeBuyAndUpgradeNewNode(ns: NS): boolean {
    const purchase_cost = ns.hacknet.getPurchaseNodeCost()
    if (purchase_cost > ns.getServerMoneyAvailable("home") * max_money_frac) return false
    const id = ns.hacknet.purchaseNode()
    if (computeFullUpgradeCost(ns, id) > ns.getServerMoneyAvailable("home") * max_money_frac) return false
    doFullUpgrade(ns, id)
    return true
}

/** @param {NS} ns */
export function buyAndUpgradeAllHacknetNodes(ns: NS) {
    while(true) {
        const finished = maybeBuyAndUpgradeNewNode(ns)
        if(finished) {
            ns.tprint(`Purchased and upgraded hacknet node. Now have ${ns.hacknet.numNodes()} nodes`)
        }
        else {
            break
        }
    }
}



