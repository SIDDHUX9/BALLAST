import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Monitor loop running every 30 seconds (Convex minimum interval)
crons.interval("monitor", { seconds: 30 }, internal.keeper.tick, {});

// Prune rolling window ICR snapshots and error logs hourly to keep storage minimal
crons.interval("prune-history", { hours: 1 }, internal.keeper.pruneOldData, {});

export default crons;
