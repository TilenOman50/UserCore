import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CustomerRiskLevel, KycStatus } from "@usercore/shared-types";

import { apiFetch, IDENTITY_API_URL } from "../api";

export type Customer = {
  id: string;
  customerId: string;
  workspaceId: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  kycStatus: KycStatus;
  riskLevel: CustomerRiskLevel | null;
  kycSessionId: string | null;
  kycCompletedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerSortField =
  | "createdAt"
  | "firstName"
  | "country"
  | "kycStatus"
  | "riskLevel";

export type CustomerFilters = {
  page: number;
  limit: number;
  status?: KycStatus;
  riskLevel?: CustomerRiskLevel;
  country?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  archived?: boolean;
  sortBy?: CustomerSortField;
  sortDir?: "asc" | "desc";
};

export type CustomersResponse = {
  items: Customer[];
  total: number;
  page: number;
  totalPages: number;
};

export type CustomerStats = {
  total: number;
  byStatus: { status: KycStatus; count: number }[];
  byRisk: { riskLevel: CustomerRiskLevel | null; count: number }[];
  byCountry: { country: string | null; count: number }[];
  overTime: { day: string; count: number }[];
};

const BASE = `${IDENTITY_API_URL}/identity/profiles`;

export const useCustomers = (
  workspaceId: string | null,
  filters: CustomerFilters,
) =>
  useQuery({
    queryKey: ["customers", workspaceId, filters],
    enabled: !!workspaceId,
    queryFn: () => {
      const p = new URLSearchParams();
      p.set("page", String(filters.page));
      p.set("limit", String(filters.limit));
      if (filters.status) p.set("status", filters.status);
      if (filters.riskLevel) p.set("riskLevel", filters.riskLevel);
      if (filters.country) p.set("country", filters.country);
      if (filters.search) p.set("search", filters.search);
      if (filters.fromDate) p.set("fromDate", filters.fromDate);
      if (filters.toDate) p.set("toDate", filters.toDate);
      if (filters.archived) p.set("archived", "true");
      if (filters.sortBy) p.set("sortBy", filters.sortBy);
      if (filters.sortDir) p.set("sortDir", filters.sortDir);
      return apiFetch<CustomersResponse>(
        `${BASE}/workspace/${encodeURIComponent(workspaceId!)}/table?${p.toString()}`,
      );
    },
  });

export type StatsRange = "all" | "24h" | "week" | "month" | "year";

export const useCustomerStats = (
  workspaceId: string | null,
  range: StatsRange = "all",
) =>
  useQuery({
    queryKey: ["customer-stats", workspaceId, range],
    enabled: !!workspaceId,
    queryFn: () => {
      const p = new URLSearchParams();
      if (range !== "all") p.set("range", range);
      return apiFetch<CustomerStats>(
        `${BASE}/workspace/${encodeURIComponent(workspaceId!)}/stats?${p.toString()}`,
      );
    },
  });

export const useCustomer = (customerId: string | null) =>
  useQuery({
    queryKey: ["customer", customerId],
    enabled: !!customerId,
    queryFn: () =>
      apiFetch<Customer>(`${BASE}/customer/${encodeURIComponent(customerId!)}`),
  });

export const useArchiveCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { customerId: string; archived: boolean }) =>
      apiFetch<Customer>(
        `${BASE}/customer/${encodeURIComponent(data.customerId)}/archive`,
        {
          method: "PATCH",
          body: JSON.stringify({ archived: data.archived }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-stats"] });
      qc.invalidateQueries({ queryKey: ["customer"] });
    },
  });
};

// Manual reviewer override of a customer's status and/or risk from the table.
export const useUpdateCustomerClassification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      customerId: string;
      kycStatus?: KycStatus;
      riskLevel?: CustomerRiskLevel;
    }) =>
      apiFetch<Customer>(
        `${BASE}/customer/${encodeURIComponent(data.customerId)}/classification`,
        {
          method: "PATCH",
          body: JSON.stringify({
            kycStatus: data.kycStatus,
            riskLevel: data.riskLevel,
          }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-stats"] });
      qc.invalidateQueries({ queryKey: ["customer"] });
    },
  });
};
