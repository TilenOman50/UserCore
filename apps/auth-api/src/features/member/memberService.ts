import { HTTPException } from "hono/http-exception";

import type { Logger } from "@usercore/logger";
import { generateId } from "@usercore/shared-types";

import type { Mailer } from "../../mailer";
import type { WorkspaceAccessRepository } from "../workspaceAccess/workspaceAccessRepository";
import type { MemberRepository } from "./memberRepository";

const VALID_ROLES = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof VALID_ROLES)[number];

const isValidRole = (value: string): value is MemberRole =>
  (VALID_ROLES as readonly string[]).includes(value);

const deriveNameFromEmail = (email: string) => {
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export const createMemberService = (props: {
  memberRepository: MemberRepository;
  workspaceAccessRepository: WorkspaceAccessRepository;
  mailer: Mailer;
  logger: Logger;
}) => {
  const { memberRepository, workspaceAccessRepository, mailer, logger } = props;

  const inviteMember = async (data: {
    email: string;
    role: string;
    organizationId: string;
    workspaceName: string;
    inviterName: string;
    inviterMemberId?: string;
    workspaceIds?: string[];
  }) => {
    if (!isValidRole(data.role)) {
      throw new HTTPException(400, { message: `Invalid role: ${data.role}` });
    }

    const email = data.email.toLowerCase().trim();

    let invitedUser = await memberRepository.findUserByEmail(email);

    if (invitedUser) {
      const existingMember = await memberRepository.findMember(
        invitedUser.id,
        data.organizationId,
      );
      if (existingMember) {
        throw new HTTPException(409, {
          message: "User is already a member of this workspace",
        });
      }
    } else {
      const userId = generateId("user");
      invitedUser = await memberRepository.createUser({
        id: userId,
        name: deriveNameFromEmail(email),
        email,
      });
      logger.info({ msg: "Invited user account created", userId, email });
    }

    const newMember = await memberRepository.createMember({
      id: generateId("member"),
      userId: invitedUser!.id,
      organizationId: data.organizationId,
      role: data.role,
    });

    // Grant access to the requested workspaces. For owners/admins this is
    // redundant (they implicitly see all org workspaces) but harmless.
    // For members, this is the only way they can see anything.
    for (const workspaceId of data.workspaceIds ?? []) {
      await workspaceAccessRepository.grantAccess({
        id: generateId("workspaceaccess"),
        workspaceId,
        userId: invitedUser!.id,
        createdBy: data.inviterMemberId,
      });
    }

    await mailer.sendInvitationEmail({
      to: email,
      workspaceName: data.workspaceName,
      inviterName: data.inviterName,
      role: data.role,
    });

    logger.info({
      msg: "Member invited",
      memberId: newMember!.id,
      email,
      role: data.role,
    });

    return { member: newMember!, user: invitedUser! };
  };

  const listMembers = async (props: {
    organizationId: string;
    search?: string;
    status?: "active" | "pending";
    role?: string;
    workspaceId?: string;
    page: number;
    limit: number;
  }) => {
    return memberRepository.listMembersWithUserByOrganization(props);
  };

  const updateRole = async (data: {
    memberId: string;
    newRole: string;
    callerRole: string;
  }) => {
    if (!isValidRole(data.newRole)) {
      throw new HTTPException(400, {
        message: `Invalid role: ${data.newRole}`,
      });
    }

    const target = await memberRepository.findMemberById(data.memberId);
    if (!target) {
      throw new HTTPException(404, { message: "Member not found" });
    }

    // Only owners can grant ownership
    if (data.newRole === "owner" && data.callerRole !== "owner") {
      throw new HTTPException(403, {
        message: "Only owners can grant ownership",
      });
    }

    // Only owners can change an existing owner's role
    if (target.role === "owner" && data.callerRole !== "owner") {
      throw new HTTPException(403, {
        message: "Only owners can change an owner's role",
      });
    }

    // Don't allow demoting the last owner — would leave the workspace ownerless
    if (target.role === "owner" && data.newRole !== "owner") {
      const owners = await memberRepository.countOwners(target.organizationId);
      if (owners <= 1) {
        throw new HTTPException(403, {
          message:
            "Can't change the last owner's role — promote someone else to owner first",
        });
      }
    }

    const updated = await memberRepository.updateMemberRole(
      data.memberId,
      data.newRole,
    );
    if (!updated) {
      throw new HTTPException(500, {
        message: "Failed to update member role",
      });
    }
    return updated;
  };

  const removeMember = async (data: {
    memberId: string;
    callerRole: string;
  }) => {
    const target = await memberRepository.findMemberById(data.memberId);
    if (!target) {
      throw new HTTPException(404, { message: "Member not found" });
    }

    // Only owners can remove an owner
    if (target.role === "owner" && data.callerRole !== "owner") {
      throw new HTTPException(403, {
        message: "Only owners can remove an owner",
      });
    }

    // Don't allow removing the last owner
    if (target.role === "owner") {
      const owners = await memberRepository.countOwners(target.organizationId);
      if (owners <= 1) {
        throw new HTTPException(403, {
          message:
            "Can't remove the last owner — promote someone else to owner first",
        });
      }
    }

    // Fully delete the user — cascades to drop their sessions, accounts,
    // member rows in any org, and workspace access. UserCore treats "remove"
    // as a hard delete since identity is tied to a corporate email and
    // revocation is the standard workflow.
    await memberRepository.deleteUser(target.userId);
    logger.info({
      msg: "User deleted",
      memberId: data.memberId,
      userId: target.userId,
    });
  };

  return { inviteMember, listMembers, updateRole, removeMember };
};

export type MemberService = ReturnType<typeof createMemberService>;
