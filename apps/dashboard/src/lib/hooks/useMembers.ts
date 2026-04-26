import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, AUTH_API_URL } from "../api";

export type Role = "owner" | "admin" | "member";

export type Member = {
  memberId: string;
  role: string;
  createdAt: string;
  userId: string;
  userName: string;
  userEmail: string;
  emailVerified: boolean;
  workspaceAccess: string[];
};

export type MembersListResponse = {
  items: Member[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type MembersListFilters = {
  search?: string;
  status?: "active" | "pending";
  role?: Role;
  workspaceId?: string;
  page: number;
  limit: number;
};

export const useMembers = (
  organizationId: string,
  filters: MembersListFilters,
) => {
  return useQuery({
    queryKey: ["members", organizationId, filters],
    queryFn: () => {
      const params = new URLSearchParams({
        organizationId,
        page: String(filters.page),
        limit: String(filters.limit),
      });
      if (filters.search) params.set("q", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.role) params.set("role", filters.role);
      if (filters.workspaceId) params.set("workspaceId", filters.workspaceId);
      return apiFetch<MembersListResponse>(
        `${AUTH_API_URL}/auth/members?${params.toString()}`,
      );
    },
    enabled: !!organizationId,
  });
};

export const useInviteMember = (organizationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      email: string;
      role: Role;
      workspaceIds?: string[];
    }) =>
      apiFetch<{ memberId: string; userId: string }>(
        `${AUTH_API_URL}/auth/members/invite`,
        {
          method: "POST",
          body: JSON.stringify({ ...data, organizationId }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["members", organizationId],
      });
    },
  });
};

export const useUpdateMemberRole = (organizationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { memberId: string; role: Role }) =>
      apiFetch<{ memberId: string; role: string }>(
        `${AUTH_API_URL}/auth/members/${encodeURIComponent(data.memberId)}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: data.role, organizationId }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["members", organizationId],
      });
    },
  });
};

export const useRemoveMember = (organizationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<void>(
        `${AUTH_API_URL}/auth/members/${encodeURIComponent(memberId)}?organizationId=${encodeURIComponent(organizationId)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["members", organizationId],
      });
    },
  });
};
