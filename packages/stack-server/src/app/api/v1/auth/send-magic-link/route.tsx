import { NextRequest, NextResponse } from "next/server";
import * as yup from "yup";
import { prismaClient } from "@/prisma-client";
import { deprecatedSmartRouteHandler } from "@/route-handlers/smart-route-handler";
import { deprecatedParseRequest } from "@/route-handlers/smart-request";
import { sendMagicLink } from "@/email";
import { getApiKeySet, publishableClientKeyHeaderSchema } from "@/lib/api-keys";
import { getProject } from "@/lib/projects";
import { validateUrl } from "@/lib/utils";
import { StackAssertionError, StatusError } from "@stackframe/stack-shared/dist/utils/errors";
import { KnownErrors } from "@stackframe/stack-shared";
import { createTeamOnSignUp } from "@/lib/users";

const postSchema = yup.object({
  headers: yup.object({
    "x-stack-publishable-client-key": publishableClientKeyHeaderSchema.default(""),
    "x-stack-project-id": yup.string().required(),
  }).required(),
  body: yup.object({
    email: yup.string().required(),
    redirectUrl: yup.string().required(),
  }),
});

export const POST = deprecatedSmartRouteHandler(async (req: NextRequest) => {
  const { 
    headers: { 
      "x-stack-project-id": projectId, 
      "x-stack-publishable-client-key": publishableClientKey 
    },
    body: { 
      email,
      redirectUrl
    } 
  } = await deprecatedParseRequest(req, postSchema);
  
  if (!await getApiKeySet(projectId, { publishableClientKey })) {
    throw new KnownErrors.ApiKeyNotFound();
  }

  const project = await getProject(projectId);
  if (!project) {
    throw new StackAssertionError("Project not found");
  }

  if (!project.evaluatedConfig.magicLinkEnabled) {
    throw new StatusError(StatusError.Forbidden, "Magic link is not enabled for this project");
  }

  if (!project.evaluatedConfig.signUpEnabled) {
    throw new StatusError(StatusError.Forbidden, "new signup is not enabled");
  }

  const users = await prismaClient.projectUser.findMany({
    where: {
      projectId,
      primaryEmail: email,
      authWithEmail: true,
    },
  });

  if (users.length > 1) {
    throw new StackAssertionError("Multiple users found with the same email");
  }
  let user = users.length > 0 ? users[0] : null;

  const newUser = !user;

  if (!user) {
    user = await prismaClient.projectUser.create({
      data: {
        projectId,
        primaryEmail: email,
        primaryEmailVerified: false,
        authWithEmail: true,
      },
    });

    await createTeamOnSignUp(projectId, user.projectUserId);
  }
  
  if (
    !validateUrl(
      redirectUrl, 
      project.evaluatedConfig.domains,
      project.evaluatedConfig.allowLocalhost 
    )
  ) {
    throw new KnownErrors.RedirectUrlNotWhitelisted();
  }
  
  await sendMagicLink(projectId, user.projectUserId, redirectUrl, newUser);

  return new NextResponse();
});
