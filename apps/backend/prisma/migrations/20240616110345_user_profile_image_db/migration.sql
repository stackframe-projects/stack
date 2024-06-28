/*
  Warnings:

  - You are about to drop the column `uploadedProfileImage` on the `ProjectUser` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProjectUser" DROP COLUMN "uploadedProfileImage",
ADD COLUMN     "uploadedProfileImageId" UUID;

-- CreateTable
CREATE TABLE "ProjectUserProfileImage" (
    "projectId" TEXT NOT NULL,
    "id" UUID NOT NULL,
    "image" BYTEA NOT NULL,
    "userId" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectUserProfileImage_projectId_userId_key" ON "ProjectUserProfileImage"("projectId", "userId");

-- AddForeignKey
ALTER TABLE "ProjectUserProfileImage" ADD CONSTRAINT "ProjectUserProfileImage_projectId_userId_fkey" FOREIGN KEY ("projectId", "userId") REFERENCES "ProjectUser"("projectId", "projectUserId") ON DELETE RESTRICT ON UPDATE CASCADE;
