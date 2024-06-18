import { ServerAuthApplicationOptions, StackServerInterface } from "./serverInterface";
import { EmailConfigJson, ProjectJson, SharedProvider, StandardProvider } from "./clientInterface";
import { InternalSession } from "../sessions";

export type AdminAuthApplicationOptions = Readonly<
  ServerAuthApplicationOptions &
  (
    | {
      superSecretAdminKey: string,
    }
    | {
      projectOwnerSession: InternalSession,
    }
  )
>

export type OAuthProviderUpdateOptions = {
  id: string,
  enabled: boolean,
} & (
  | {
    type: SharedProvider,
  }
  | {
    type: StandardProvider,
    clientId: string,
    clientSecret: string,
  }
)

export type ProjectUpdateOptions = {
  displayName?: string,
  description?: string,
  isProductionMode?: boolean,
  config?: {
    domains?: {
      domain: string,
      handlerPath: string,
    }[],
    oauthProviders?: OAuthProviderUpdateOptions[],
    credentialEnabled?: boolean,
    magicLinkEnabled?: boolean,
    allowLocalhost?: boolean,
    signUpEnabled?: boolean,
    createTeamOnSignUp?: boolean,
    emailConfig?: EmailConfigJson,
  },
};

export type ApiKeySetBaseJson = {
  id: string,
  description: string,
  expiresAtMillis: number,
  manuallyRevokedAtMillis: number | null,
  createdAtMillis: number,
};

export type ApiKeySetFirstViewJson = ApiKeySetBaseJson & {
  publishableClientKey?: string,
  secretServerKey?: string,
  superSecretAdminKey?: string,
};

export type ApiKeySetJson = ApiKeySetBaseJson & {
  publishableClientKey: null | {
    lastFour: string,
  },
  secretServerKey: null | {
    lastFour: string,
  },
  superSecretAdminKey: null | {
    lastFour: string,
  },
};

export type ApiKeySetCreateOptions = {
  hasPublishableClientKey: boolean,
  hasSecretServerKey: boolean,
  hasSuperSecretAdminKey: boolean,
  expiresAt: Date,
  description: string,
};

export class StackAdminInterface extends StackServerInterface {
  constructor(public readonly options: AdminAuthApplicationOptions) {
    super(options);
  }

  protected async sendAdminRequest(path: string, options: RequestInit, session: InternalSession | null, requestType: "admin" = "admin") {
    return await this.sendServerRequest(
      path,
      {
        ...options,
        headers: {
          "x-stack-super-secret-admin-key": "superSecretAdminKey" in this.options ? this.options.superSecretAdminKey : "",
          ...options.headers,
        },
      },
      session,
      requestType,
    );
  }

  async getProject(options?: { showDisabledOAuth?: boolean }): Promise<ProjectJson> {
    const response = await this.sendAdminRequest(
      "/projects/" + encodeURIComponent(this.projectId),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(options ?? {}),
      },
      null,
    );
    return await response.json();
  }

  async updateProject(update: ProjectUpdateOptions): Promise<ProjectJson> {
    const response = await this.sendAdminRequest(
      "/projects/" + encodeURIComponent(this.projectId),
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(update),
      },
      null,
    );
    return await response.json();
  }

  async createApiKeySet(
    options: ApiKeySetCreateOptions,
  ): Promise<ApiKeySetFirstViewJson> {
    const response = await this.sendServerRequest(
      "/api-keys",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(options),
      },
      null,
    );
    return await response.json();
  }

  async listApiKeySets(): Promise<ApiKeySetJson[]> {
    const response = await this.sendAdminRequest("/api-keys", {}, null);
    const json = await response.json();
    return json.map((k: ApiKeySetJson) => k);
  }

  async revokeApiKeySetById(id: string) {
    await this.sendAdminRequest(
      `/api-keys/${id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          revoke: true,
        }),
      },
      null,
    );
  }

  async getApiKeySet(id: string, session: InternalSession): Promise<ApiKeySetJson> {
    const response = await this.sendAdminRequest(`/api-keys/${id}`, {}, session);
    return await response.json();
  }
}

