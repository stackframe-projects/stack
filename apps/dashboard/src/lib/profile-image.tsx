import { prismaClient } from "@/prisma-client";
import { KnownErrors, ServerUserJson } from "@stackframe/stack-shared";
import { updateServerUser } from "./users";
export async function upsertUserImage(
  userId: string,
  projectId: string,
  image:string
):Promise<ServerUserJson | null>{
  let imageData=await base64ToBlob(image);
  const imageSizeKB = imageData.size / 1024;
  if (imageSizeKB > 500) {
    throw new KnownErrors.InvalidProfileImage();
  }
  const arrayBuffer = await imageData.arrayBuffer(); 
  const imageBuffer = Buffer.from(arrayBuffer);
  const upsertedProfileImage = await prismaClient.projectUserProfileImage.upsert({
    where: {
      projectId_userId: {
        projectId: projectId,
        userId: userId,
      },
    },
    create: {
      projectId: projectId,
      userId: userId,
      image: imageBuffer,
    },
    update: {
      image: imageBuffer,
    },
    select: {
      id: true
    }
  });
  let updateProfileImageUrl={
    profileImageUrl:`${process.env.NEXT_PUBLIC_STACK_URL}/api/v1/profile-image/${upsertedProfileImage.id}?reload=${new Date().getTime()}`,
    uploadedProfileImageId:upsertedProfileImage.id,
  };
  const update = await updateServerUser(projectId,userId,updateProfileImageUrl);
  return update;
}

export async function getUserImage(id:string):Promise<Buffer|null> {
  const userImageRecord = await prismaClient.projectUserProfileImage.findFirst({
    where: {
      id: id,
    },
    select: {
      image: true,
    },
  });
  if (userImageRecord) {
    const buffer = Buffer.from(userImageRecord.image);
    return buffer;
  } else {
    return null;
  }
}

async function base64ToBlob(base64Data: string): Promise<Blob> {
  const byteCharacters = atob(base64Data.split(',')[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: 'image/jpeg' });
}