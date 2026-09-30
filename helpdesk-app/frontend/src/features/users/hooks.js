import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { changeActive, changeRole, listUsers } from '../../api/users.js';

export const useUserList = (params) =>
  useQuery({
    queryKey: ['users', 'list', params],
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
  });

function useUserMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export const useChangeRole = () => useUserMutation(({ id, role }) => changeRole(id, role));
export const useChangeActive = () =>
  useUserMutation(({ id, isActive }) => changeActive(id, isActive));
