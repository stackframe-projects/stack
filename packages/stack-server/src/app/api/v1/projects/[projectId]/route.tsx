import { NextRequest, NextResponse } from "next/server";
import * as yup from "yup";
import { StackAssertionError, StatusError } from "@stackframe/stack-shared/dist/utils/errors";
import { deprecatedSmartRouteHandler } from "@/route-handlers/smart-route-handler";
import { deprecatedParseRequest } from "@/route-handlers/smart-request";
import { checkApiKeySet, publishableClientKeyHeaderSchema, superSecretAdminKeyHeaderSchema } from "@/lib/api-keys";
import { getProject, isProjectAdmin, getProjectUpdateSchema, projectSchemaToUpdateOptions, updateProject } from "@/lib/projects";
import { ClientProjectJson } from "@stackframe/stack-shared/dist/interface/clientInterface";
import { KnownErrors } from "@stackframe/stack-shared";

const putOrGetSchema = yup.object({
  headers: yup.object({
    "x-stack-publishable-client-key": publishableClientKeyHeaderSchema.default(""),
    "x-stack-super-secret-admin-key": superSecretAdminKeyHeaderSchema.default(""),
    "x-stack-admin-access-token": yup.string().default(""),
    "x-stack-project-id": yup.string().required(),
  }).required(),
  body: getProjectUpdateSchema().optional(),
});

const handler = deprecatedSmartRouteHandler(async (req: NextRequest, options: { params: { apiKeyId: string } }) => {
  const {
    headers: {
      "x-stack-project-id": projectId,
      "x-stack-publishable-client-key": publishableClientKey,
      "x-stack-super-secret-admin-key": superSecretAdminKey,
      "x-stack-admin-access-token": adminAccessToken,
    },
    body,
  } = await deprecatedParseRequest(req, putOrGetSchema);  

  const { ...update } = body ?? {};

  const pkValid = await checkApiKeySet(projectId, { publishableClientKey });
  const asValid = await isProjectAdmin(projectId, adminAccessToken);
  const saValid = await checkApiKeySet(projectId, { superSecretAdminKey });

  const typedUpdate = projectSchemaToUpdateOptions(update);

  if (asValid || saValid) {
    const project = await updateProject(
      projectId,
      typedUpdate,
    );
    return NextResponse.json(project);
  } else if (pkValid) {
    if (Object.entries(update).length !== 0) {
      throw new StatusError(StatusError.Forbidden, "Can't update project with only publishable client key");
    }

    const project = await getProject(projectId);
    if (!project) {
      throw new StackAssertionError("Project not found but the API key was valid? Something weird happened");
    }
    const clientProject: ClientProjectJson = {
      id: project.id,
      credentialEnabled: project.evaluatedConfig.credentialEnabled,
      magicLinkEnabled: project.evaluatedConfig.magicLinkEnabled,
      signUpEnabled: project.evaluatedConfig.signUpEnabled,
      oauthProviders: project.evaluatedConfig.oauthProviders.map(
        (provider) => ({
          id: provider.id,
          enabled: provider.enabled,
        }),
      ),
    };
 
    return NextResponse.json(clientProject);
  } else {
    throw new KnownErrors.ApiKeyNotFound();
  }
});
export const GET = handler;
export const PUT = handler;
export const POST = handler;
export const DELETE = handler;
