import * as oauth from 'oauth4webapi';

import { Result } from "../utils/results";
import { ReadonlyJson } from '../utils/json';
import { KnownError, KnownErrors } from '../known-errors';
import { StackAssertionError, captureError, throwErr } from '../utils/errors';
import { ProjectUpdateOptions } from './adminInterface';
import { cookies } from '@stackframe/stack-sc';
import { generateSecureRandomString } from '../utils/crypto';
import { AccessToken, RefreshToken, InternalSession } from '../sessions';
import { globalVar } from '../utils/globals';

type UserCustomizableJson = {
  displayName: string | null,
  clientMetadata: ReadonlyJson,
  selectedTeamId: string | null,
};

export type UserJson = UserCustomizableJson & {
  projectId: string,
  id: string,
  primaryEmail: string | null,
  primaryEmailVerified: boolean,
  displayName: string | null,
  clientMetadata: ReadonlyJson,
  profileImageUrl: string | null,
  signedUpAtMillis: number,
  /**
   * not used anymore, for backwards compatibility
   */
  authMethod: "credential" | "oauth",
  hasPassword: boolean,
  authWithEmail: boolean,
  oauthProviders: string[],
  selectedTeamId: string | null,
  selectedTeam: TeamJson | null,
};

export type UserUpdateJson = Partial<UserCustomizableJson>;

export type ClientProjectJson = {
  id: string,
  credentialEnabled: boolean,
  magicLinkEnabled: boolean,
  signUpEnabled: boolean,
  oauthProviders: {
    id: string,
    enabled: boolean,
  }[],
};

export type ClientInterfaceOptions = {
  clientVersion: string,
  baseUrl: string,
  projectId: string,
} & ({
  publishableClientKey: string,
} | {
  projectOwnerSession: InternalSession,
});

export type SharedProvider = "shared-github" | "shared-google" | "shared-facebook" | "shared-microsoft" | "shared-spotify";
export const sharedProviders = [
  "shared-github",
  "shared-google",
  "shared-facebook",
  "shared-microsoft",
  "shared-spotify",
] as const;

export type StandardProvider = "github" | "facebook" | "google" | "microsoft" | "spotify";
export const standardProviders = [
  "github",
  "facebook",
  "google",
  "microsoft",
  "spotify",
] as const;

export function toStandardProvider(provider: SharedProvider | StandardProvider): StandardProvider {
  return provider.replace("shared-", "") as StandardProvider;
}

export function toSharedProvider(provider: SharedProvider | StandardProvider): SharedProvider {
  return "shared-" + provider as SharedProvider;
}

export type ProjectJson = {
  id: string,
  displayName: string,
  description?: string,
  createdAtMillis: number,
  userCount: number,
  isProductionMode: boolean,
  evaluatedConfig: {
    id: string,
    allowLocalhost: boolean,
    credentialEnabled: boolean,
    magicLinkEnabled: boolean,
    signUpEnabled:boolean,
    oauthProviders: OAuthProviderConfigJson[],
    emailConfig?: EmailConfigJson,
    domains: DomainConfigJson[],
    createTeamOnSignUp: boolean,
  },
};

export type OAuthProviderConfigJson = {
  id: string,
  enabled: boolean,
} & (
  | { type: SharedProvider }
  | {
    type: StandardProvider,
    clientId: string,
    clientSecret: string,
  }
);

export type EmailConfigJson = (
  {
    type: "standard",
    senderName: string,
    senderEmail: string,
    host: string,
    port: number,
    username: string,
    password: string,
  }
  | {
    type: "shared",
  }
);

export type DomainConfigJson = {
  domain: string,
  handlerPath: string,
}

export type ProductionModeError = {
  errorMessage: string,
  fixUrlRelative: string,
};


export type OrglikeJson = {
  id: string,
  displayName: string,
  createdAtMillis: number,
};

export type TeamJson = OrglikeJson;

export type OrganizationJson = OrglikeJson;

export type TeamMemberJson = {
  userId: string,
  teamId: string,
  displayName: string | null,
}


export type PermissionDefinitionScopeJson =
  | { type: "global" }
  | { type: "any-team" }
  | { type: "specific-team", teamId: string };

export type PermissionDefinitionJson = {
  id: string,
  scope: PermissionDefinitionScopeJson,
};

export class StackClientInterface {
  constructor(public readonly options: ClientInterfaceOptions) {
    // nothing here
  }

  get projectId() {
    return this.options.projectId;
  }

  getApiUrl() {
    return this.options.baseUrl + "/api/v1";
  }

  public async fetchNewAccessToken(refreshToken: RefreshToken) {
    if (!('publishableClientKey' in this.options)) {
      // TODO support it
      throw new Error("Admin session token is currently not supported for fetching new access token. Did you try to log in on a StackApp initiated with the admin session?");
    }

    const as = {
      issuer: this.options.baseUrl,
      algorithm: 'oauth2',
      token_endpoint: this.getApiUrl() + '/auth/token',
    };
    const client: oauth.Client = {
      client_id: this.projectId,
      client_secret: this.options.publishableClientKey,
      token_endpoint_auth_method: 'client_secret_basic',
    };

    const rawResponse = await oauth.refreshTokenGrantRequest(
      as,
      client,
      refreshToken.token,
    );
    const response = await this._processResponse(rawResponse);

    if (response.status === "error") {
      const error = response.error;
      if (error instanceof KnownErrors.RefreshTokenError) {
        return null;
      }
      throw error;
    }

    if (!response.data.ok) {
      const body = await response.data.text();
      throw new Error(`Failed to send refresh token request: ${response.status} ${body}`);
    }

    const result = await oauth.processRefreshTokenResponse(as, client, response.data);
    if (oauth.isOAuth2Error(result)) {
      // TODO Handle OAuth 2.0 response body error
      throw new StackAssertionError("OAuth error", { result });
    }

    if (!result.access_token) {
      throw new StackAssertionError("Access token not found in token endpoint response, this is weird!");
    }

    return new AccessToken(result.access_token);
  }

  protected async sendClientRequest(
    path: string, 
    requestOptions: RequestInit, 
    session: InternalSession | null,
    requestType: "client" | "server" | "admin" = "client",
  ) {
    session ??= this.createSession({
      refreshToken: null,
    });


    return await Result.orThrowAsync(
      Result.retry(
        () => this.sendClientRequestInner(path, requestOptions, session!, requestType),
        5,
        { exponentialDelayBase: 1000 },
      )
    );
  }

  public createSession(options: Omit<ConstructorParameters<typeof InternalSession>[0], "refreshAccessTokenCallback">): InternalSession {
    const session = new InternalSession({
      refreshAccessTokenCallback: async (refreshToken) => await this.fetchNewAccessToken(refreshToken),
      ...options,
    });
    return session;
  }

  protected async sendClientRequestAndCatchKnownError<E extends typeof KnownErrors[keyof KnownErrors]>(
    path: string, 
    requestOptions: RequestInit, 
    tokenStoreOrNull: InternalSession | null,
    errorsToCatch: readonly E[],
  ): Promise<Result<
    Response & {
      usedTokens: {
        accessToken: AccessToken,
        refreshToken: RefreshToken | null,
      } | null,
    },
    InstanceType<E>
  >> {
    try {
      return Result.ok(await this.sendClientRequest(path, requestOptions, tokenStoreOrNull));
    } catch (e) {
      for (const errorType of errorsToCatch) {
        if (e instanceof errorType) {
          return Result.error(e as InstanceType<E>);
        }
      }
      throw e;
    }
  }

  private async sendClientRequestInner(
    path: string,
    options: RequestInit,
    session: InternalSession,
    requestType: "client" | "server" | "admin",
  ): Promise<Result<Response & {
    usedTokens: {
      accessToken: AccessToken,
      refreshToken: RefreshToken | null,
    } | null,
  }>> {
    /**
     * `tokenObj === null` means the session is invalid/not logged in
     */
    let tokenObj = await session.getPotentiallyExpiredTokens();

    let adminSession = "projectOwnerSession" in this.options ? this.options.projectOwnerSession : null;
    let adminTokenObj = adminSession ? await adminSession.getPotentiallyExpiredTokens() : null;

    // all requests should be dynamic to prevent Next.js caching
    cookies?.();

    const url = this.getApiUrl() + path;
    const params: RequestInit = {
      /**
       * This fetch may be cross-origin, in which case we don't want to send cookies of the
       * original origin (this is the default behaviour of `credentials`).
       * 
       * To help debugging, also omit cookies on same-origin, so we don't accidentally
       * implement reliance on cookies anywhere.
       * 
       * However, Cloudflare Workers don't actually support `credentials`, so we only set it
       * if Cloudflare-exclusive globals are not detected. https://github.com/cloudflare/workers-sdk/issues/2514
       */
      ...("WebSocketPair" in globalVar ? {} : {
        credentials: "omit",
      }),
      ...options,
      headers: {
        "X-Stack-Override-Error-Status": "true",
        "X-Stack-Project-Id": this.projectId,
        "X-Stack-Request-Type": requestType,
        "X-Stack-Client-Version": this.options.clientVersion,
        ...(tokenObj ? {
          "Authorization": "StackSession " + tokenObj.accessToken.token,
          "X-Stack-Access-Token": tokenObj.accessToken.token,
        } : {}),
        ...(tokenObj?.refreshToken ? {
          "X-Stack-Refresh-Token": tokenObj.refreshToken.token,
        } : {}),
        ...('publishableClientKey' in this.options ? {
          "X-Stack-Publishable-Client-Key": this.options.publishableClientKey,
        } : {}),
        ...(adminTokenObj ? {
          "X-Stack-Admin-Access-Token": adminTokenObj.accessToken.token,
        } : {}),
        /**
         * Next.js until v15 would cache fetch requests by default, and forcefully disabling it was nearly impossible.
         * 
         * This header is used to change the cache key and hence always disable it, because we do our own caching.
         * 
         * When we drop support for Next.js <15, we may be able to remove this header, but please make sure that this is
         * the case (I haven't actually tested.)
         */
        "X-Stack-Random-Nonce": generateSecureRandomString(),
        ...options.headers,
      },
      /**
       * Cloudflare Workers does not support cache, so don't pass it there
       */
      ...("WebSocketPair" in globalVar ? {} : {
        cache: "no-store",
      }),
    };

    let rawRes;
    try {
      rawRes = await fetch(url, params);
    } catch (e) {
      if (e instanceof TypeError) {
        // Network error, retry
        console.log("Stack detected a network error, retrying.", e);
        return Result.error(e);
      }
      throw e;
    }

    const processedRes = await this._processResponse(rawRes);
    if (processedRes.status === "error") {
      // If the access token is invalid, reset it and retry
      if (processedRes.error instanceof KnownErrors.InvalidAccessToken) {
        if (!tokenObj) {
          throw new StackAssertionError("Received invalid access token, but session is not logged in", { tokenObj, processedRes });
        }
        session.markAccessTokenExpired(tokenObj.accessToken);
        return Result.error(processedRes.error);
      }

      // Same for the admin access token
      // TODO HACK: Some of the backend hasn't been ported to use the new error codes, so if we have project owner tokens we need to check for ApiKeyNotFound too. Once the migration to smartRouteHandlers is complete, we can check for InvalidAdminAccessToken only.
      if (adminSession && (processedRes.error instanceof KnownErrors.InvalidAdminAccessToken || processedRes.error instanceof KnownErrors.ApiKeyNotFound)) {
        if (!adminTokenObj) {
          throw new StackAssertionError("Received invalid admin access token, but admin session is not logged in", { adminTokenObj, processedRes });
        }
        adminSession.markAccessTokenExpired(adminTokenObj.accessToken);
        return Result.error(processedRes.error);
      }

      // Known errors are client side errors, so except for the ones above they should not be retried
      // Hence, throw instead of returning an error
      throw processedRes.error;
    }


    const res = Object.assign(processedRes.data, {
      usedTokens: tokenObj,
    });
    if (res.ok) {
      return Result.ok(res);
    } else {
      const error = await res.text();

      // Do not retry, throw error instead of returning one
      throw new Error(`Failed to send request to ${url}: ${res.status} ${error}`);
    }
  }

  private async _processResponse(rawRes: Response): Promise<Result<Response, KnownError>> {
    let res = rawRes;
    if (rawRes.headers.has("x-stack-actual-status")) {
      const actualStatus = Number(rawRes.headers.get("x-stack-actual-status"));
      res = new Response(rawRes.body, {
        status: actualStatus,
        statusText: rawRes.statusText,
        headers: rawRes.headers,
      });
    }

    // Handle known errors
    if (res.headers.has("x-stack-known-error")) {
      const errorJson = await res.json();
      if (res.headers.get("x-stack-known-error") !== errorJson.code) {
        throw new StackAssertionError("Mismatch between x-stack-known-error header and error code in body; the server's response is invalid");
      }
      const error = KnownError.fromJson(errorJson);
      return Result.error(error);
    }

    return Result.ok(res);
  }

  public async checkFeatureSupport(options: { featureName?: string } & ReadonlyJson): Promise<never> {
    const res = await this.sendClientRequest("/check-feature-support", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options),
    }, null);

    throw new StackAssertionError(await res.text());
  }

  async sendForgotPasswordEmail(
    email: string,
    redirectUrl: string,
  ): Promise<KnownErrors["UserNotFound"] | undefined> {
    const res = await this.sendClientRequestAndCatchKnownError(
      "/auth/forgot-password",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          redirectUrl,
        }),
      },
      null,
      [KnownErrors.UserNotFound],
    );

    if (res.status === "error") {
      return res.error;
    }
  }

  async sendVerificationEmail(
    emailVerificationRedirectUrl: string, 
    session: InternalSession
  ): Promise<KnownErrors["EmailAlreadyVerified"] | undefined> {
    const res = await this.sendClientRequestAndCatchKnownError(
      "/auth/send-verification-email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          emailVerificationRedirectUrl,
        }),
      },
      session,
      [KnownErrors.EmailAlreadyVerified]
    );

    if (res.status === "error") {
      return res.error;
    }
  }

  async sendMagicLinkEmail(
    email: string, 
    redirectUrl: string,
  ): Promise<KnownErrors["RedirectUrlNotWhitelisted"] | undefined> {
    const res = await this.sendClientRequestAndCatchKnownError(
      "/auth/send-magic-link",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          redirectUrl,
        }),
      },
      null,
      [KnownErrors.RedirectUrlNotWhitelisted]
    );

    if (res.status === "error") {
      return res.error;
    }
  }

  async resetPassword(
    options: { code: string } & ({ password: string } | { onlyVerifyCode: boolean })
  ): Promise<KnownErrors["PasswordResetError"] | undefined> {
    const res = await this.sendClientRequestAndCatchKnownError(
      "/auth/password-reset",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(options),
      },
      null,
      [KnownErrors.PasswordResetError]
    );

    if (res.status === "error") {
      return res.error;
    }
  }

  async updatePassword(
    options: { oldPassword: string, newPassword: string }, 
    session: InternalSession
  ): Promise<KnownErrors["PasswordMismatch"] | KnownErrors["PasswordRequirementsNotMet"] | undefined> {
    const res = await this.sendClientRequestAndCatchKnownError(
      "/auth/update-password",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(options),
      },
      session,
      [KnownErrors.PasswordMismatch, KnownErrors.PasswordRequirementsNotMet]
    );

    if (res.status === "error") {
      return res.error;
    }
  }

  async verifyPasswordResetCode(code: string): Promise<KnownErrors["PasswordResetCodeError"] | undefined> {
    const res = await this.resetPassword({ code, onlyVerifyCode: true });
    if (res && !(res instanceof KnownErrors.PasswordResetCodeError)) {
      throw res;
    }
    return res;
  }

  async verifyEmail(code: string): Promise<KnownErrors["EmailVerificationError"] | undefined> {
    const res = await this.sendClientRequestAndCatchKnownError(
      "/auth/email-verification",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code,
        }),
      },
      null,
      [KnownErrors.EmailVerificationError]
    );

    if (res.status === "error") {
      return res.error;
    }
  }

  async signInWithCredential(
    email: string, 
    password: string, 
    session: InternalSession
  ): Promise<KnownErrors["EmailPasswordMismatch"] | { accessToken: string, refreshToken: string }> {
    const res = await this.sendClientRequestAndCatchKnownError(
      "/auth/signin",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password,
        }),
      },
      session,
      [KnownErrors.EmailPasswordMismatch]
    );

    if (res.status === "error") {
      return res.error;
    }

    const result = await res.data.json();
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  async signUpWithCredential(
    email: string,
    password: string,
    emailVerificationRedirectUrl: string,
    session: InternalSession,
  ): Promise<KnownErrors["UserEmailAlreadyExists"] | KnownErrors["PasswordRequirementsNotMet"] | { accessToken: string, refreshToken: string }> {
    const res = await this.sendClientRequestAndCatchKnownError(
      "/auth/signup",
      {
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          emailVerificationRedirectUrl,
        }),
      },
      session,
      [KnownErrors.UserEmailAlreadyExists, KnownErrors.PasswordRequirementsNotMet]
    );

    if (res.status === "error") {
      return res.error;
    }

    const result = await res.data.json();
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  async signInWithMagicLink(code: string, session: InternalSession): Promise<KnownErrors["MagicLinkError"] | { newUser: boolean, accessToken: string, refreshToken: string }> {
    const res = await this.sendClientRequestAndCatchKnownError(
      "/auth/magic-link-verification",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code,
        }),
      },
      null,
      [KnownErrors.MagicLinkError]
    );

    if (res.status === "error") {
      return res.error;
    }

    const result = await res.data.json();
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      newUser: result.newUser,
    };
  }

  async getOAuthUrl(
    options: {
      provider: string, 
      redirectUrl: string, 
      errorRedirectUrl: string,
      afterCallbackRedirectUrl?: string,
      codeChallenge: string, 
      state: string,
      type: "authenticate" | "link",
      providerScope?: string,
    } & ({ type: "authenticate" } | { type: "link", session: InternalSession })
  ): Promise<string> {
    const updatedRedirectUrl = new URL(options.redirectUrl);
    for (const key of ["code", "state"]) {
      if (updatedRedirectUrl.searchParams.has(key)) {
        console.warn("Redirect URL already contains " + key + " parameter, removing it as it will be overwritten by the OAuth callback");
      }
      updatedRedirectUrl.searchParams.delete(key);
    }

    if (!('publishableClientKey' in this.options)) {
      // TODO fix
      throw new Error("Admin session token is currently not supported for OAuth");
    }
    const url = new URL(this.getApiUrl() + "/auth/authorize/" + options.provider.toLowerCase());
    url.searchParams.set("client_id", this.projectId);
    url.searchParams.set("client_secret", this.options.publishableClientKey);
    url.searchParams.set("redirect_uri", updatedRedirectUrl.toString());
    url.searchParams.set("scope", "openid");
    url.searchParams.set("state", options.state);
    url.searchParams.set("grant_type", "authorization_code");
    url.searchParams.set("code_challenge", options.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("type", options.type);
    url.searchParams.set("errorRedirectUrl", options.errorRedirectUrl);
    
    if (options.afterCallbackRedirectUrl) {
      url.searchParams.set("afterCallbackRedirectUrl", options.afterCallbackRedirectUrl);
    }
    
    if (options.type === "link") {
      const tokens = await options.session.getPotentiallyExpiredTokens();
      url.searchParams.set("token", tokens?.accessToken.token || "");

      if (options.providerScope) {
        url.searchParams.set("providerScope", options.providerScope);
      }
    }

    return url.toString();
  }

  async callOAuthCallback(options: {
    oauthParams: URLSearchParams, 
    redirectUri: string,
    codeVerifier: string, 
    state: string,
  }): Promise<{ newUser: boolean, afterCallbackRedirectUrl?: string, accessToken: string, refreshToken: string }> {
    if (!('publishableClientKey' in this.options)) {
      // TODO fix
      throw new Error("Admin session token is currently not supported for OAuth");
    }
    const as = {
      issuer: this.options.baseUrl,
      algorithm: 'oauth2',
      token_endpoint: this.getApiUrl() + '/auth/token',
    };
    const client: oauth.Client = {
      client_id: this.projectId,
      client_secret: this.options.publishableClientKey,
      token_endpoint_auth_method: 'client_secret_basic',
    };
    const params = oauth.validateAuthResponse(as, client, options.oauthParams, options.state);
    if (oauth.isOAuth2Error(params)) {
      throw new StackAssertionError("Error validating outer OAuth response", { params }); // Handle OAuth 2.0 redirect error
    }
    const response = await oauth.authorizationCodeGrantRequest(
      as,
      client,
      params,
      options.redirectUri,
      options.codeVerifier,
    );

    const result = await oauth.processAuthorizationCodeOAuth2Response(as, client, response);
    if (oauth.isOAuth2Error(result)) {
      // TODO Handle OAuth 2.0 response body error
      throw new StackAssertionError("Outer OAuth error during authorization code response", { result });
    }

    return {
      newUser: result.newUser as boolean,
      afterCallbackRedirectUrl: result.afterCallbackRedirectUrl as string | undefined,
      accessToken: result.access_token,
      refreshToken: result.refresh_token ?? throwErr("Refresh token not found in outer OAuth response"),
    };
  }

  async signOut(session: InternalSession): Promise<void> {
    const tokenObj = await session.getPotentiallyExpiredTokens();
    if (tokenObj) {
      if (!tokenObj.refreshToken) {
        // TODO implement this
        captureError("clientInterface.signOut()", new StackAssertionError("Signing out a user without access to the refresh token does not invalidate the session on the server. Please open an issue in the Stack repository if you see this error"));
      } else {
        const res = await this.sendClientRequest(
          "/auth/signout",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              refreshToken: tokenObj.refreshToken.token,
            }),
          },
          session,
        );
        await res.json();
      }
    }
    session.markInvalid();
  }

  async getClientUserByToken(tokenStore: InternalSession): Promise<Result<UserJson>> {
    const response = await this.sendClientRequest(
      "/current-user",
      {},
      tokenStore,
    );
    const user: UserJson | null = await response.json();
    if (!user) return Result.error(new Error("Failed to get user"));
    return Result.ok(user);
  }

  async listClientUserTeamPermissions(
    options: {
      teamId: string,
      type: 'global' | 'team', 
      direct: boolean, 
    },
    session: InternalSession
  ): Promise<PermissionDefinitionJson[]> {
    const response = await this.sendClientRequest(
      `/current-user/teams/${options.teamId}/permissions?type=${options.type}&direct=${options.direct}`,
      {},
      session,
    );
    const permissions: PermissionDefinitionJson[] = await response.json();
    return permissions;
  }

  async listClientUserTeams(session: InternalSession): Promise<TeamJson[]> {
    const response = await this.sendClientRequest(
      "/current-user/teams",
      {},
      session,
    );
    const teams: TeamJson[] = await response.json();
    return teams;
  }

  async getClientProject(): Promise<Result<ClientProjectJson>> {
    const response = await this.sendClientRequest("/projects/" + this.options.projectId, {}, null);
    const project: ClientProjectJson | null = await response.json();
    if (!project) return Result.error(new Error("Failed to get project"));
    return Result.ok(project);
  }

  async setClientUserCustomizableData(update: UserUpdateJson, session: InternalSession) {
    await this.sendClientRequest(
      "/current-user",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(update),
      },
      session,
    );
  }

  async listProjects(session: InternalSession): Promise<ProjectJson[]> {
    const response = await this.sendClientRequest("/projects", {}, session);
    if (!response.ok) {
      throw new Error("Failed to list projects: " + response.status + " " + (await response.text()));
    }

    const json = await response.json();
    return json;
  }

  async createProject(
    project: ProjectUpdateOptions & { displayName: string },
    session: InternalSession,
  ): Promise<ProjectJson> {
    const fetchResponse = await this.sendClientRequest(
      "/projects",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(project),
      },
      session,
    );
    if (!fetchResponse.ok) {
      throw new Error("Failed to create project: " + fetchResponse.status + " " + (await fetchResponse.text()));
    }

    const json = await fetchResponse.json();
    return json;
  }

  async getAccessToken(
    provider: string,
    scope: string,
    session: InternalSession,
  ): Promise<{ accessToken: string }> {
    const response = await this.sendClientRequest(
      `/auth/access-token/${provider}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ scope }),
      },
      session,
    );
    const json = await response.json();
    return {
      accessToken: json.accessToken,
    };
  }
}

export function getProductionModeErrors(project: ProjectJson): ProductionModeError[] {
  const errors: ProductionModeError[] = [];
  const fixUrlRelative = `/projects/${project.id}/domains`;

  if (project.evaluatedConfig.allowLocalhost) {
    errors.push({
      errorMessage: "Localhost is not allowed in production mode, turn off 'Allow localhost' in project settings",
      fixUrlRelative,
    });
  }

  for (const { domain } of project.evaluatedConfig.domains) {
    let url;
    try {
      url = new URL(domain);
    } catch (e) {
      errors.push({
        errorMessage: "Domain should be a valid URL: " + domain,
        fixUrlRelative,
      });
      continue;
    }

    if (url.hostname === "localhost") {
      errors.push({
        errorMessage: "Domain should not be localhost: " + domain,
        fixUrlRelative,
      });
    } else if (!url.hostname.includes(".") || url.hostname.match(/\d+(\.\d+)*/)) {
      errors.push({
        errorMessage: "Not a valid domain" + domain,
        fixUrlRelative,
      });
    } else if (url.protocol !== "https:") {
      errors.push({
        errorMessage: "Domain should be HTTPS: " + domain,
        fixUrlRelative,
      });
    }
  }

  return errors;
}

