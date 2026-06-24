import type { Logger } from "@usercore/logger";
import type { CustomerRiskLevel, KycStatus } from "@usercore/shared-types";

import type {
  CustomerListFilters,
  CustomerProfileRepository,
} from "./customerProfileRepository";

export type StatsRange = "all" | "24h" | "week" | "month" | "year";

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_MS: Record<StatsRange, number | undefined> = {
  all: undefined,
  "24h": DAY_MS,
  week: 7 * DAY_MS,
  month: 30 * DAY_MS,
  year: 365 * DAY_MS,
};

export const createCustomerProfileService = (props: {
  customerProfileRepository: CustomerProfileRepository;
  logger: Logger;
}) => {
  const { customerProfileRepository, logger } = props;

  const getProfile = async (customerId: string) => {
    return customerProfileRepository.findByCustomerId(customerId);
  };

  const listByWorkspace = async (workspaceId: string) => {
    return customerProfileRepository.findByWorkspaceId(workspaceId);
  };

  // Paginated + filtered list for the customers table.
  const listCustomers = async (filters: CustomerListFilters) => {
    const { rows, total } =
      await customerProfileRepository.listForTable(filters);
    return {
      items: rows,
      total,
      page: filters.page,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    };
  };

  const createProfile = async (data: {
    customerId: string;
    workspaceId: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    nationality?: string;
    address?: string;
    city?: string;
    country?: string;
  }) => {
    logger.info({
      msg: "Creating customer profile",
      customerId: data.customerId,
    });
    return customerProfileRepository.create(data);
  };

  const updateProfile = async (
    customerId: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      nationality: string;
      address: string;
      city: string;
      country: string;
    }>,
  ) => {
    logger.info({ msg: "Updating customer profile", customerId });
    return customerProfileRepository.update(customerId, data);
  };

  const updateKycStatus = async (props: {
    customerId: string;
    kycStatus: KycStatus;
    kycSessionId?: string;
    riskLevel?: CustomerRiskLevel;
  }) => {
    logger.info({
      msg: "Updating KYC status",
      customerId: props.customerId,
      status: props.kycStatus,
    });
    return customerProfileRepository.updateKycStatus({
      ...props,
      kycCompletedAt: ["approved", "rejected"].includes(props.kycStatus)
        ? new Date()
        : undefined,
    });
  };

  const setArchived = async (customerId: string, archived: boolean) => {
    logger.info({ msg: "Setting customer archived", customerId, archived });
    return customerProfileRepository.setArchived(customerId, archived);
  };

  // Manual reviewer override of status/risk from the customers table.
  const setClassification = async (
    customerId: string,
    data: { kycStatus?: KycStatus; riskLevel?: CustomerRiskLevel },
  ) => {
    logger.info({
      msg: "Updating customer classification",
      customerId,
      ...data,
    });
    return customerProfileRepository.setClassification(customerId, data);
  };

  // Create-or-update from a kyc.completed event (a decided customer lands in
  // the customers table).
  const upsertFromKyc = async (props: {
    customerId: string;
    workspaceId: string;
    kycStatus: KycStatus;
    kycSessionId?: string;
    riskLevel?: CustomerRiskLevel;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    nationality?: string;
    country?: string;
  }) => {
    logger.info({
      msg: "Upserting customer profile from KYC",
      customerId: props.customerId,
      status: props.kycStatus,
    });
    return customerProfileRepository.upsertFromKyc({
      ...props,
      kycCompletedAt: ["approved", "rejected"].includes(props.kycStatus)
        ? new Date()
        : undefined,
    });
  };

  // Stats time-frame: filter the dashboard cards/charts by registration date.
  const getStats = async (workspaceId: string, range?: StatsRange) => {
    const ms = range ? RANGE_MS[range] : undefined;
    const from = ms ? new Date(Date.now() - ms) : undefined;
    return customerProfileRepository.getStats(workspaceId, from);
  };

  return {
    getProfile,
    listByWorkspace,
    listCustomers,
    createProfile,
    updateProfile,
    updateKycStatus,
    upsertFromKyc,
    setArchived,
    setClassification,
    getStats,
  };
};

export type CustomerProfileService = ReturnType<
  typeof createCustomerProfileService
>;
