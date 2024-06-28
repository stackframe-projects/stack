import { 
  ClientInterfaceOptions, 
  UserJson, 
  StackClientInterface,
  OrglikeJson,
  UserUpdateJson,
  PermissionDefinitionJson,
  PermissionDefinitionScopeJson as PermissionDefinitionScopeJson,
  TeamMemberJson,
} from "./clientInterface";
import { Result } from "../utils/results";
import { ReadonlyJson } from "../utils/json";
import { EmailTemplateCrud, ListEmailTemplatesCrud } from "./crud/email-templates";
import { InternalSession } from "../sessions";

export type ServerUserJson = UserJson & {
  serverMetadata: ReadonlyJson,
};

export type ServerUserUpdateJson = UserUpdateJson & {
  serverMetadata?: ReadonlyJson,
  primaryEmail?: string | null,
  primaryEmailVerified?: boolean,
  profileImageUrl?:string,
  uploadedProfileImageId?:string,
}

export type ServerOrglikeCustomizableJson = Pick<ServerOrglikeJson, "displayName">;
export type ServerOrglikeJson = OrglikeJson & {};

export type ServerTeamCustomizableJson = ServerOrglikeCustomizableJson;
export type ServerTeamJson = ServerOrglikeJson;

export type ServerTeamMemberJson = TeamMemberJson & {
  user: ServerUserJson,
};

export type ServerPermissionDefinitionCustomizableJson = {
  readonly id: string,
  readonly description?: string,
  readonly scope: PermissionDefinitionScopeJson,
  readonly containPermissionIds: string[],
};

export type ServerPermissionDefinitionJson = PermissionDefinitionJson & ServerPermissionDefinitionCustomizableJson & {
  readonly __databaseUniqueId: string,
  readonly scope: PermissionDefinitionScopeJson,
};

export type ServerAuthApplicationOptions = (
  & ClientInterfaceOptions
  & (
    | {
      readonly secretServerKey: string,
    }
    | {
      readonly projectOwnerSession: InternalSession,
    }
  )
);

export const emailTemplateTypes = ['EMAIL_VERIFICATION', 'PASSWORD_RESET', 'MAGIC_LINK'] as const;
export type EmailTemplateType = typeof emailTemplateTypes[number];

export class StackServerInterface extends StackClientInterface {
  constructor(public override options: ServerAuthApplicationOptions) {
    super(options);
  }

  protected async sendServerRequest(path: string, options: RequestInit, session: InternalSession | null, requestType: "server" | "admin" = "server") {
    return await this.sendClientRequest(
      path,
      {
        ...options,
        headers: {
          "x-stack-secret-server-key": "secretServerKey" in this.options ? this.options.secretServerKey : "",
          ...options.headers,
        },
      },
      session,
      requestType,
    );
  }

  async getServerUserByToken(session: InternalSession): Promise<Result<ServerUserJson>> {
    const response = await this.sendServerRequest(
      "/current-user?server=true",
      {},
      session,
    );
    const user: ServerUserJson | null = await response.json();
    if (!user) return Result.error(new Error("Failed to get user"));
    return Result.ok(user);
  }

  async getServerUserById(userId: string): Promise<Result<ServerUserJson>> {
    const response = await this.sendServerRequest(
      `/users/${userId}?server=true`,
      {},
      null,
    );
    const user: ServerUserJson | null = await response.json();
    if (!user) return Result.error(new Error("Failed to get user"));
    return Result.ok(user);
  }

  async listServerUserTeamPermissions(
    options: {
      teamId: string,
      type: 'global' | 'team', 
      direct: boolean, 
    },
    session: InternalSession
  ): Promise<ServerPermissionDefinitionJson[]> {
    const response = await this.sendServerRequest(
      `/current-user/teams/${options.teamId}/permissions?type=${options.type}&direct=${options.direct}&server=true`,
      {},
      session,
    );
    const permissions: ServerPermissionDefinitionJson[] = await response.json();
    return permissions;
  }

  async listServerUserTeams(session: InternalSession): Promise<ServerTeamJson[]> {
    const response = await this.sendServerRequest(
      "/current-user/teams?server=true",
      {},
      session,
    );
    const teams: ServerTeamJson[] = await response.json();
    return teams;
  }

  async listPermissionDefinitions(): Promise<ServerPermissionDefinitionJson[]> {
    const response = await this.sendServerRequest(`/permission-definitions?server=true`, {}, null);
    return await response.json();
  }

  async createPermissionDefinition(data: ServerPermissionDefinitionCustomizableJson): Promise<ServerPermissionDefinitionJson> {
    const response = await this.sendServerRequest(
      "/permission-definitions?server=true",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          scope: {
            type: "any-team",
          }
        }),
      },
      null,
    );
    return await response.json();
  }

  async updatePermissionDefinition(permissionId: string, data: Partial<ServerPermissionDefinitionCustomizableJson>): Promise<void> {
    await this.sendServerRequest(
      `/permission-definitions/${permissionId}?server=true`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(data),
      },
      null,
    );
  }

  async deletePermissionDefinition(permissionId: string): Promise<void> {
    await this.sendServerRequest(
      `/permission-definitions/${permissionId}?server=true`,
      { method: "DELETE" },
      null,
    );
  }

  async listServerUsers(): Promise<ServerUserJson[]> {
    const response = await this.sendServerRequest("/users?server=true", {}, null);
    return await response.json();
  }

  async listServerTeams(): Promise<ServerTeamJson[]> {
    const response = await this.sendServerRequest("/teams?server=true", {}, null);
    const json = await response.json();
    return json;
  }

  async listServerTeamMembers(teamId: string): Promise<ServerTeamMemberJson[]> {
    const response = await this.sendServerRequest(`/teams/${teamId}/users?server=true`, {}, null);
    return await response.json();
  }

  async createServerTeam(data: ServerTeamCustomizableJson): Promise<ServerTeamJson> {
    const response = await this.sendServerRequest(
      "/teams?server=true",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(data),
      },
      null,
    );
    return await response.json();
  }
  
  async updateServerTeam(teamId: string, data: Partial<ServerTeamCustomizableJson>): Promise<void> {
    await this.sendServerRequest(
      `/teams/${teamId}?server=true`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(data),
      },
      null,
    );
  }

  async deleteServerTeam(teamId: string): Promise<void> {
    await this.sendServerRequest(
      `/teams/${teamId}?server=true`,
      { method: "DELETE" },
      null,
    );
  }

  async addServerUserToTeam(options: {
    userId: string, 
    teamId: string,
  }) {
    await this.sendServerRequest(
      `/teams/${options.teamId}/users/${options.userId}?server=true`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
      null,
    );
  }

  async removeServerUserFromTeam(options: {
    userId: string, 
    teamId: string,
  }) {
    await this.sendServerRequest(
      `/teams/${options.teamId}/users/${options.userId}?server=true`,
      {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
      null,
    );
  }

  async setServerUserCustomizableData(userId: string, update: ServerUserUpdateJson) {
    await this.sendServerRequest(
      `/users/${userId}?server=true`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(update),
      },
      null,
    );
  }

  async listServerTeamMemberPermissions(
    options: {
      teamId: string, 
      userId: string, 
      type: 'global' | 'team', 
      direct: boolean,
    }
  ): Promise<ServerPermissionDefinitionJson[]> {
    const response = await this.sendServerRequest(
      `/teams/${options.teamId}/users/${options.userId}/permissions?server=true&type=${options.type}&direct=${options.direct}`, 
      {}, 
      null
    );
    return await response.json();
  }

  async grantServerTeamUserPermission(teamId: string, userId: string, permissionId: string, type: 'global' | 'team') {
    await this.sendServerRequest(
      `/teams/${teamId}/users/${userId}/permissions/${permissionId}?server=true`,
      { 
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ type }),
      },
      null,
    );
  }

  async revokeServerTeamUserPermission(teamId: string, userId: string, permissionId: string, type: 'global' | 'team') {
    await this.sendServerRequest(
      `/teams/${teamId}/users/${userId}/permissions/${permissionId}?server=true`,
      { 
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ type }),
      },
      null,
    );
  }

  async deleteServerServerUser(userId: string) {
    await this.sendServerRequest(
      `/users/${userId}?server=true`,
      {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
      null,
    );
  }

  async listEmailTemplates(): Promise<ListEmailTemplatesCrud['Server']['Read']> {
    const response = await this.sendServerRequest(`/email-templates?server=true`, {}, null);
    return await response.json();
  }

  async updateEmailTemplate(type: EmailTemplateType, data: EmailTemplateCrud['Server']['Update']): Promise<void> {
    await this.sendServerRequest(
      `/email-templates/${type}?server=true`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(data),
      },
      null,
    );
  }

  async resetEmailTemplate(type: EmailTemplateType): Promise<void> {
    await this.sendServerRequest(
      `/email-templates/${type}?server=true`,
      { method: "DELETE" },
      null,
    );
  }

  async createServerTeamForUser(
    userId: string,
    data: ServerTeamCustomizableJson,
    session: InternalSession,
  ): Promise<ServerTeamJson> {
    const response = await this.sendClientRequest(
      `/users/${userId}/teams?server=true`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(data),
      },
      session,
    );
    return await response.json();
  }
}
