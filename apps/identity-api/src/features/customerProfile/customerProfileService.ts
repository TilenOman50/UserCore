import type { Logger } from "@usercore/logger";
import type { KycStatus } from "@usercore/shared-types";

import type { CustomerProfileRepository } from "./customerProfileRepository";

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

  return {
    getProfile,
    listByWorkspace,
    createProfile,
    updateProfile,
    updateKycStatus,
  };
};

export type CustomerProfileService = ReturnType<
  typeof createCustomerProfileService
>;
