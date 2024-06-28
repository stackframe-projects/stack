import { UserJson, ServerUserJson, KnownErrors } from "@stackframe/stack-shared";
import { Prisma } from "@prisma/client";
import { prismaClient } from "@/prisma-client";
import { getProject } from "@/lib/projects";
import { filterUndefined } from "@stackframe/stack-shared/dist/utils/objects";
import { UserUpdateJson } from "@stackframe/stack-shared/dist/interface/clientInterface";
import { ServerUserUpdateJson } from "@stackframe/stack-shared/dist/interface/serverInterface";
import {
  createServerTeamForUser,
  getClientTeamFromServerTeam,
  getServerTeamFromDbType,
} from "./teams";
import { StackAssertionError } from "@stackframe/stack-shared/dist/utils/errors";

export const serverUserInclude = {
  projectUserOAuthAccounts: true,
  teamMembers: {
    include: {
      team: true,
    },
  },
} as const satisfies Prisma.ProjectUserInclude;

export type ServerUserDB = Prisma.ProjectUserGetPayload<{ include: typeof serverUserInclude }>;

export async function getClientUser(projectId: string, userId: string): Promise<UserJson | null> {
  return await updateClientUser(projectId, userId, {});
}

export async function getServerUser(projectId: string, userId: string): Promise<ServerUserJson | null> {
  return await updateServerUser(projectId, userId, {});
}

export async function listServerUsers(projectId: string): Promise<ServerUserJson[]> {
  const users = await prismaClient.projectUser.findMany({
    where: {
      projectId,
    },
    include: serverUserInclude,
  });

  return users.map((u) => getServerUserFromDbType(u));
}

export async function updateClientUser(
  projectId: string,
  userId: string,
  update: UserUpdateJson,
): Promise<UserJson | null> {
  const user = await updateServerUser(
    projectId,
    userId,
    {
      displayName: update.displayName,
      clientMetadata: update.clientMetadata,
      selectedTeamId: update.selectedTeamId,
    },
  );
  if (!user) {
    return null;
  }

  return getClientUserFromServerUser(user);
}

export async function updateServerUser(
  projectId: string,
  userId: string,
  update: ServerUserUpdateJson,
): Promise<ServerUserJson | null> {
  let user;
  try {
    if (update.selectedTeamId !== undefined) {
      await prismaClient.teamMember.updateMany({
        where: {
          projectId,
          projectUserId: userId,
        },
        data: {
          selected: null,
        },
      });

      if (update.selectedTeamId !== null) {
        await prismaClient.teamMember.update({
          where: {
            projectId_projectUserId_teamId: {
              projectId,
              projectUserId: userId,
              teamId: update.selectedTeamId,
            },
          },
          data: {
            selected: true,
          },
        });
      }
    }

    user = await prismaClient.projectUser.update({
      where: {
        projectId_projectUserId: {
          projectId,
          projectUserId: userId,
        },
      },
      include: serverUserInclude,
      data: filterUndefined({
        displayName: update.displayName,
        primaryEmail: update.primaryEmail,
        primaryEmailVerified: update.primaryEmailVerified,
        clientMetadata: update.clientMetadata as any,
        serverMetadata: update.serverMetadata as any,
        selectedTeamId: update.selectedTeamId,
        profileImageUrl:update.profileImageUrl,
        uploadedProfileImageId:update.uploadedProfileImageId,
      }),
    });
  } catch (e) {
    // TODO this is kinda hacky, instead we should have the entire method throw an error instead of returning null and have a separate getServerUser function that may return null
    if ((e as any)?.code === 'P2025') {
      return null;
    }
    throw e;
  }

  return getServerUserFromDbType(user);
}

export async function deleteServerUser(projectId: string, userId: string): Promise<void> {
  try {
    await prismaClient.projectUser.delete({
      where: {
        projectId: projectId,
        projectId_projectUserId: {
          projectId,
          projectUserId: userId,
        },
      },
    });
  } catch (e) {
    if ((e as any)?.code === 'P2025') {
      throw new KnownErrors.UserNotFound();
    }
    throw e;
  }
}

function getClientUserFromServerUser(serverUser: ServerUserJson): UserJson {
  return {
    projectId: serverUser.projectId,
    id: serverUser.id,
    displayName: serverUser.displayName,
    primaryEmail: serverUser.primaryEmail,
    primaryEmailVerified: serverUser.primaryEmailVerified,
    profileImageUrl: serverUser.profileImageUrl,
    signedUpAtMillis: serverUser.signedUpAtMillis,
    clientMetadata: serverUser.clientMetadata,
    authMethod: serverUser.authMethod, // not used anymore, for backwards compatibility
    authWithEmail: serverUser.authWithEmail,
    hasPassword: serverUser.hasPassword,
    oauthProviders: serverUser.oauthProviders,
    selectedTeamId: serverUser.selectedTeamId,
    selectedTeam: serverUser.selectedTeam && getClientTeamFromServerTeam(serverUser.selectedTeam),
  };
}

export function getServerUserFromDbType(
  user: ServerUserDB,
): ServerUserJson {
  const rawSelectedTeam = user.teamMembers.filter(m => m.selected)[0]?.team;
  return {
    projectId: user.projectId,
    id: user.projectUserId,
    displayName: user.displayName,
    primaryEmail: user.primaryEmail,
    primaryEmailVerified: user.primaryEmailVerified,
    profileImageUrl: user.profileImageUrl,
    signedUpAtMillis: user.createdAt.getTime(),
    clientMetadata: user.clientMetadata as any,
    serverMetadata: user.serverMetadata as any,
    authMethod: user.passwordHash ? 'credential' : 'oauth', // not used anymore, for backwards compatibility
    hasPassword: !!user.passwordHash,
    authWithEmail: user.authWithEmail,
    oauthProviders: user.projectUserOAuthAccounts.map((a) => a.oauthProviderConfigId),
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    selectedTeamId: rawSelectedTeam?.teamId ?? null,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    selectedTeam: (rawSelectedTeam && getServerTeamFromDbType(rawSelectedTeam)) ?? null,
  };
}

export async function createTeamOnSignUp(projectId: string, userId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) { 
    throw new Error('Project not found'); 
  }
  if (!project.evaluatedConfig.createTeamOnSignUp) {
    return;
  }
  const user = await getServerUser(projectId, userId);
  if (!user) {
    throw new Error('User not found');
  }

  await createServerTeamForUser({
    projectId,
    userId,
    data: { displayName: user.displayName ? `${user.displayName}'s personal team` : 'Personal team' },
  });
}
