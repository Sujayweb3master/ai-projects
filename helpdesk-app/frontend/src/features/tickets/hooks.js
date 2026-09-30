import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ticketsApi from '../../api/tickets.js';
import { listUsers } from '../../api/users.js';

export const ticketKeys = {
  all: ['tickets'],
  list: (params) => ['tickets', 'list', params],
  detail: (id) => ['tickets', 'detail', id],
  comments: (id, page) => ['tickets', 'detail', id, 'comments', page],
  events: (id) => ['tickets', 'detail', id, 'events'],
};

export const useTicketList = (params) =>
  useQuery({
    queryKey: ticketKeys.list(params),
    queryFn: () => ticketsApi.listTickets(params),
    placeholderData: keepPreviousData,
  });

export const useTicket = (id) =>
  useQuery({ queryKey: ticketKeys.detail(id), queryFn: () => ticketsApi.getTicket(id) });

export const useComments = (id, page) =>
  useQuery({
    queryKey: ticketKeys.comments(id, page),
    queryFn: () => ticketsApi.listComments(id, { page, pageSize: 50 }),
    placeholderData: keepPreviousData,
  });

export const useEvents = (id) =>
  useQuery({ queryKey: ticketKeys.events(id), queryFn: () => ticketsApi.listEvents(id) });

/** Active admins, for the assignee picker. */
export const useAssignableAdmins = (enabled) =>
  useQuery({
    queryKey: ['users', 'assignable-admins'],
    queryFn: () => listUsers({ role: 'ADMIN', isActive: 'true', pageSize: 100 }),
    enabled,
    staleTime: 60_000,
  });

/** After any ticket change: cache the fresh ticket, refresh lists and the history. */
function useTicketMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (ticket) => {
      queryClient.setQueryData(ticketKeys.detail(ticket.id), ticket);
      queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] });
      queryClient.invalidateQueries({ queryKey: ticketKeys.events(ticket.id) });
    },
  });
}

export const useCreateTicket = () => useTicketMutation((input) => ticketsApi.createTicket(input));
export const useUpdateTicket = (id) =>
  useTicketMutation((input) => ticketsApi.updateTicket(id, input));
export const useChangeStatus = (id) =>
  useTicketMutation((status) => ticketsApi.changeStatus(id, status));
export const useChangeAssignee = (id) =>
  useTicketMutation((assigneeId) => ticketsApi.changeAssignee(id, assigneeId));

/** Optimistically append the comment; roll back (and keep the draft) if the request fails. */
export function useAddComment(ticketId, page, author) {
  const queryClient = useQueryClient();
  const key = ticketKeys.comments(ticketId, page);
  return useMutation({
    mutationFn: (body) => ticketsApi.addComment(ticketId, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      if (previous) {
        queryClient.setQueryData(key, {
          ...previous,
          data: [
            ...previous.data,
            {
              id: `optimistic-${Date.now()}`,
              body: body.trim(),
              author,
              createdAt: new Date().toISOString(),
              pending: true,
            },
          ],
        });
      }
      return { previous };
    },
    onError: (_error, _body, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId, 'comments'] }),
  });
}
