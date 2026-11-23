"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedule = schedule;
exports.startJobs = startJobs;
exports.stopJobs = stopJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("../lib/logger");
const tasks = [];
/** Registers a cron task with consistent logging and error isolation. */
function schedule(name, expression, handler) {
    const task = node_cron_1.default.schedule(expression, () => {
        const startedAt = Date.now();
        handler()
            .then(() => logger_1.logger.info({ job: name, ms: Date.now() - startedAt }, 'Job completed'))
            .catch((error) => logger_1.logger.error({ err: error, job: name }, 'Job failed'));
    }, { scheduled: false });
    tasks.push(task);
}
function startJobs() {
    // Imported lazily so registering a job can import services that import this
    // module, without creating a cycle at load time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { registerMaintenanceJobs } = require('./maintenance.jobs');
    registerMaintenanceJobs();
    tasks.forEach((task) => task.start());
    logger_1.logger.info({ count: tasks.length }, 'Background jobs started');
}
function stopJobs() {
    tasks.forEach((task) => task.stop());
}
//# sourceMappingURL=index.js.map