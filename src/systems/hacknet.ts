import { NS } from "@ns";

const max_levels = 200
const max_ram = 7
const max_cores = 16

function computeFullUpgradeCost(ns: NS, id: number): number {
    const stats = ns.hacknet.getNodeStats(id)
    const core_upgrade_cost = ns.hacknet.getCoreUpgradeCost(id, max_cores - stats.cores)
    const ram_upgrade_cost = ns.hacknet.getRamUpgradeCost(id, max_ram - stats.ram)
    const level_upgrade_cost = ns.hacknet.getLevelUpgradeCost(id, max_levels - stats.level)
    // ns.tprint(`core_upgrade_cost: ${core_upgrade_cost}, ram_upgrade_cost: ${ram_upgrade_cost}, level_upgrade_cost: ${level_upgrade_cost}`)
    return core_upgrade_cost + ram_upgrade_cost + level_upgrade_cost
}

function doFullUpgrade(ns: NS, id: number) {
    const stats = ns.hacknet.getNodeStats(id)
    ns.hacknet.upgradeCore(id, max_cores - stats.cores)
    ns.hacknet.upgradeLevel(id, max_levels - stats.level)
    ns.hacknet.upgradeRam(id, max_ram - stats.ram)
    ns.tprint(`Fully upgraded hacknet node ${id}`)
}

function tryFullUpgrade(ns: NS, id: number, cost_fraction: number): boolean {
    if (computeFullUpgradeCost(ns, id) > ns.getServerMoneyAvailable("home") * cost_fraction) return false
    doFullUpgrade(ns, id)
    return true
}

function maybeBuyAndUpgradeNewNode(ns: NS, cost_fraction: number): boolean {
    const purchase_cost = ns.hacknet.getPurchaseNodeCost()
    if (purchase_cost > ns.getServerMoneyAvailable("home") * cost_fraction) return false
    const id = ns.hacknet.purchaseNode()
    ns.tprint(`Purchased hacknet node ${id}`)
    return tryFullUpgrade(ns, id, cost_fraction)

}

function isFullyUpgraded(ns: NS, id: number): boolean {
    const stats = ns.hacknet.getNodeStats(id)
    if (stats.cores < max_cores || stats.level < max_levels || stats.ram < max_ram) return false
    return true
}

/** @param {NS} ns */
export function buyAndUpgradeAllHacknetNodes(ns: NS, cost_fraction: number) {
    // Make sure existing nodes are fully upgraded before buying new ones
    for (let id = 0; id < ns.hacknet.numNodes(); id++) {
        if (!isFullyUpgraded(ns, id)) {
            const full_upgrade = tryFullUpgrade(ns, id, cost_fraction)
            if (!full_upgrade) return
        }
    }

    // Buy new nodes
    for (let id = ns.hacknet.numNodes(); id < ns.hacknet.maxNumNodes(); id++) {
        const full_upgrade = maybeBuyAndUpgradeNewNode(ns, cost_fraction)
        if(!full_upgrade) {
            return
        }
    }
}



