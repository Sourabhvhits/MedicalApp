import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../lib/logger';

const tasks: ScheduledTask[] = [];

/** Registers a cron task with consistent logging and error isolation. */
export function schedule(name: string, expression: string, handler: () => Promise<void>): void {
  const task = cron.schedule(
    expression,
    () => {
      const startedAt = Date.now();
      handler()
        .then(() => logger.info({ job: name, ms: Date.now() - startedAt }, 'Job completed'))
        .catch((error) => logger.error({ err: error, job: name }, 'Job failed'));
    },
    { scheduled: false },
  );
  tasks.push(task);
}

export function startJobs(): void {
  // Imported lazily so registering a job can import services that import this
  // module, without creating a cycle at load time.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerMaintenanceJobs } = require('./maintenance.jobs') as {
    registerMaintenanceJobs: () => void;
  };
  registerMaintenanceJobs();

  tasks.forEach((task) => task.start());
  logger.info({ count: tasks.length }, 'Background jobs started');
}

export function stopJobs(): void {
  tasks.forEach((task) => task.stop());
}
