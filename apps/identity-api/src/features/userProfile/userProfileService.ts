import type { Logger } from "@usercore/logger";
import type { KycStatus } from "@usercore/shared-types";

import type { UserProfileRepository } from "./userProfileRepository";

export const createUserProfileService = (props: {
  userProfileRepository: UserProfileRepository;
  logger: Logger;
}) => {
  const { userProfileRepository, logger } = props;

  const getProfile = async (userId: string) => {
    return userProfileRepository.findByUserId(userId);
  };

  const listByWorkspace = async (workspaceId: string) => {
    return userProfileRepository.findByWorkspaceId(workspaceId);
  };

  const createProfile = async (data: {
    userId: string;
    workspaceId: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    nationality?: string;
    address?: string;
    city?: string;
    country?: string;
  }) => {
    logger.info({ msg: "Creating user profile", userId: data.userId });
    return userProfileRepository.create(data);
  };

  const updateProfile = async (
    userId: string,
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
    logger.info({ msg: "Updating user profile", userId });
    return userProfileRepository.update(userId, data);
  };

  const updateKycStatus = async (props: {
    userId: string;
    kycStatus: KycStatus;
    kycSessionId?: string;
  }) => {
    logger.info({
      msg: "Updating KYC status",
      userId: props.userId,
      status: props.kycStatus,
    });
    return userProfileRepository.updateKycStatus({
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

export type UserProfileService = ReturnType<typeof createUserProfileService>;
