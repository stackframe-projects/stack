// import { NextRequest, NextResponse } from "next/server";
import * as yup from "yup";
// import { StatusError } from "@stackframe/stack-shared/dist/utils/errors";
// import { deprecatedSmartRouteHandler } from "@/route-handlers/smart-route-handler";
import { deprecatedParseRequest } from "@/route-handlers/smart-request";

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizationHeaderSchema } from "@/lib/tokens";
import { upsertUserImage } from "@/lib/profile-image";
const postSchema = yup.object({
  headers: yup.object({
    authorization: authorizationHeaderSchema
  }).required(),
  body: yup.object({
    userId:yup.string().required(),
    projectId:yup.string().required(),
    image: yup.string().required(),
  }).required(),
});

export const POST = async (_req: NextRequest) => {
  try {
    const {
      headers: {
        authorization
      },
      body: { 
        userId,
        projectId,
        image
      },
    } = await deprecatedParseRequest(_req, postSchema);
    if (!authorization) {
      return NextResponse.json(null);
    }
    const insertImage=await upsertUserImage(userId,projectId,image);
    return NextResponse.json(insertImage);
  } catch (error) {
    console.error("Error processing request:", error);
  }
};