import { Router } from 'express';
import { branchInput, branchUpdate } from '@acuheal/types';
import { Branch } from '../../models/Branch.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate, body } from '../../middleware/validate.js';
import { notFound } from '../../middleware/error.js';
import { ok, created } from '../../utils/http.js';
import { audit } from '../../utils/audit.js';

export const branchesRouter = Router();

/** Any signed-in user can list branches (for switcher / pickers). */
branchesRouter.get('/', async (req, res) => {
  const all = req.query.all === '1' && req.user!.role === 'ADMIN';
  const filter = all ? {} : { active: true };
  ok(res, await Branch.find(filter).sort('name').lean());
});

branchesRouter.get('/:id', async (req, res) => {
  const branch = await Branch.findById(req.params.id).lean();
  if (!branch) throw notFound('Branch not found');
  ok(res, branch);
});

branchesRouter.post('/', requirePermission('admin:manage'), validate(branchInput), async (req, res) => {
  const input = body<typeof branchInput>(req);
  const branch = await Branch.create({ ...input, createdBy: req.user!.id });
  audit({ userId: req.user!.id, action: 'create', entity: 'Branch', entityId: String(branch._id), summary: `Branch ${branch.code} created` });
  created(res, branch.toObject());
});

branchesRouter.patch('/:id', requirePermission('admin:manage'), validate(branchUpdate), async (req, res) => {
  const input = body<typeof branchUpdate>(req);
  const branch = await Branch.findByIdAndUpdate(req.params.id, { $set: { ...input, updatedBy: req.user!.id } }, { new: true }).lean();
  if (!branch) throw notFound('Branch not found');
  audit({ userId: req.user!.id, action: 'update', entity: 'Branch', entityId: String(branch._id), summary: `Branch ${branch.code} updated`, after: input });
  ok(res, branch);
});
