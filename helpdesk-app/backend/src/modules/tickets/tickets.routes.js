import { Router } from 'express';
import { requireRole } from '../../middleware/authenticate.js';
import { uuidParam, validate } from '../../middleware/validate.js';
import {
  changeAssigneeBody,
  changeStatusBody,
  createCommentBody,
  createTicketBody,
  listCommentsQuery,
  listTicketsQuery,
  updateTicketBody,
} from './tickets.schemas.js';
import { createTicketsService } from './tickets.service.js';

/** All routes require authentication (applied by the caller). */
export function ticketsRouter({ db }) {
  const router = Router();
  const service = createTicketsService({ db });
  const adminOnly = requireRole('ADMIN');

  router.get('/', validate({ query: listTicketsQuery }), async (req, res) => {
    res.json(await service.list(req.user, req.valid.query));
  });

  router.post('/', validate({ body: createTicketBody }), async (req, res) => {
    res.status(201).json(await service.create(req.user, req.valid.body));
  });

  router.get('/:id', validate({ params: uuidParam }), async (req, res) => {
    res.json(await service.getAccessibleTicket(req.user, req.valid.params.id));
  });

  router.patch(
    '/:id',
    validate({ params: uuidParam, body: updateTicketBody }),
    async (req, res) => {
      res.json(await service.update(req.user, req.valid.params.id, req.valid.body));
    },
  );

  router.patch(
    '/:id/status',
    adminOnly,
    validate({ params: uuidParam, body: changeStatusBody }),
    async (req, res) => {
      res.json(await service.changeStatus(req.user, req.valid.params.id, req.valid.body.status));
    },
  );

  router.patch(
    '/:id/assignee',
    adminOnly,
    validate({ params: uuidParam, body: changeAssigneeBody }),
    async (req, res) => {
      res.json(
        await service.changeAssignee(req.user, req.valid.params.id, req.valid.body.assigneeId),
      );
    },
  );

  router.get(
    '/:id/comments',
    validate({ params: uuidParam, query: listCommentsQuery }),
    async (req, res) => {
      res.json(await service.listComments(req.user, req.valid.params.id, req.valid.query));
    },
  );

  router.post(
    '/:id/comments',
    validate({ params: uuidParam, body: createCommentBody }),
    async (req, res) => {
      res
        .status(201)
        .json(await service.addComment(req.user, req.valid.params.id, req.valid.body.body));
    },
  );

  router.get('/:id/events', validate({ params: uuidParam }), async (req, res) => {
    res.json(await service.listEvents(req.user, req.valid.params.id));
  });

  return router;
}
