import { Router } from 'express';
import { env } from '../config/env.js';
import { requireApiKey } from '../middleware/auth.js';
import { ok } from '../utils/http.js';
import { runBirthdays, runHousekeeping, runReminders } from './index.js';

/** External cron (cron-job.org) hits these with header `x-jobs-secret: <JOBS_SECRET>`. */
export const jobsRouter = Router();

jobsRouter.use(requireApiKey(() => env.JOBS_SECRET, 'x-jobs-secret'));

jobsRouter.post('/reminders', async (req, res) => {
  const kind = req.query.kind === 'same-day' ? 'same-day' : 'day-before';
  ok(res, await runReminders(kind, { force: req.query.force === '1' }));
});

jobsRouter.post('/birthdays', async (_req, res) => {
  ok(res, await runBirthdays());
});

jobsRouter.post('/housekeeping', async (_req, res) => {
  ok(res, await runHousekeeping());
});
