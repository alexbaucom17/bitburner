import { NS } from "@ns";

// Server purchasing
function ComputeMaxRam(ns: NS, min_ram: number, cost_fraction: number): number {
    const cur_money = ns.getServerMoneyAvailable("home")
    const max_spend = cur_money * cost_fraction
    const max_servers = ns.getPurchasedServerLimit()
    let most_ram = 0
    let start_exponent = Math.floor(Math.log2(min_ram))
    for (let exp = start_exponent; exp <= 20; exp++) {
        const server_ram = 2**exp
        const server_cost = ns.getPurchasedServerCost(server_ram)
        const total_cost = max_servers * server_cost
        if (total_cost < max_spend) {
            most_ram = server_ram
        }
    }
    return most_ram
}

function MaybePurchaseNewServers(ns: NS, min_ram: number, cost_fraction: number): boolean {
    const max_ram = ComputeMaxRam(ns, min_ram, cost_fraction)
    if(max_ram === 0) return false
    ns.tprint("Purchasing new servers")
    for (let i = 0; i < ns.getPurchasedServerLimit(); i++) {
        ns.purchaseServer("pserv-" + i, max_ram);
        ns.tprint(`Purchase pserver-${i} with ${max_ram} ram`)
    }
    return true
}

function MaybeUpgradeServers(ns: NS, current_servers: string[], cost_fraction: number) : boolean {
    const cur_ram = ns.getServer(current_servers[0]).maxRam
    const max_ram = ComputeMaxRam(ns, cur_ram, cost_fraction)
    if(max_ram <= cur_ram) return false
    ns.tprint("Upgrading servers")
    for (const hostname of current_servers) {
        ns.tprint(`"Deleing server ${hostname}`)
        ns.killall(hostname, true)
        const ok = ns.deleteServer(hostname)
        if (!ok) ns.tprint(`Failed to delete ${hostname}`)
    }
    for (let i = 0; i < ns.getPurchasedServerLimit(); i++) {
        ns.purchaseServer("pserv-" + i, max_ram);
        ns.tprint(`Purchase pserver-${i} with ${max_ram} ram`)
    }
    return true
}

export function buyAndUpgradeServers(ns: NS, min_ram: number, cost_fraction: number): boolean {
    const current_servers = ns.getPurchasedServers()
    if(current_servers.length < ns.getPurchasedServerLimit()) {
        return MaybePurchaseNewServers(ns, min_ram, cost_fraction)
    } else {
        return MaybeUpgradeServers(ns, current_servers, cost_fraction)
    }
}