import { NextRequest, NextResponse } from "next/server";
import * as yup from "yup";
import { deprecatedSmartRouteHandler } from "@/route-handlers/smart-route-handler";
import { deprecatedParseRequest } from "@/route-handlers/smart-request";
import { getUserImage } from "@/lib/profile-image";


const getSchema = yup.object({
  query: yup.object({
    server: yup.string().oneOf(["true", "false"]).default("false"),
  }).required(),
});

export const GET = deprecatedSmartRouteHandler(async (req: NextRequest, options: { params: { id: string } }) => {
  const {
    query: {
      server,
    },
  } = await deprecatedParseRequest(req, getSchema);
  const imageData = await getUserImage(options.params.id);
  const headers = new Headers();
  headers.set("Content-Type", "image/jpeg");
  return new NextResponse(imageData, { status: 200, headers });
});