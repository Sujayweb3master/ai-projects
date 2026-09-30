import { Router } from 'express';
import { requireRole } from '../../middleware/authenticate.js';
import { uuidParam, validate } from '../../middleware/validate.js';
import { changeRoleBody, changeStatusBody, listUsersQuery } from './users.schemas.js';
import { createUsersService } from './users.service.js';

/** Admin-only user management. Authentication is applied by the caller. */
export function usersRouter({ db }) {
  const router = Router();
  const service = createUsersService({ db });
  router.use(requireRole('ADMIN'));

  router.get('/', validate({ query: listUsersQuery }), async (req, res) => {
    res.json(await service.list(req.valid.query));
  });

  router.patch(
    '/:id/role',
    validate({ params: uuidParam, body: changeRoleBody }),
    async (req, res) => {
      res.json(await service.changeRole(req.user, req.valid.params.id, req.valid.body.role));
    },
  );

  router.patch(
    '/:id/status',
    validate({ params: uuidParam, body: changeStatusBody }),
    async (req, res) => {
      res.json(await service.changeStatus(req.user, req.valid.params.id, req.valid.body.isActive));
    },
  );

  return router;
}
