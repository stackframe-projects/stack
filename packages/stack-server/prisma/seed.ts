import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();


async function seed() {
  console.log('Seeding database...');
  
  const oldProjects = await prisma.project.findUnique({
    where: {
      id: 'internal',
    },
  });

  if (oldProjects) {
    console.log('Internal project already exists, skipping seeding');
    return;
  }

  await prisma.project.upsert({
    where: {
      id: 'internal',
    },
    create: {
      id: 'internal',
      displayName: 'Stack Dashboard',
      description: 'Stack\'s admin dashboard',
      isProductionMode: false,
      apiKeySets: {
        create: [{
          description: "Internal API key set",
          publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY ?? require('crypto').randomBytes(8).toString("hex"),
          secretServerKey: process.env.STACK_SECRET_SERVER_KEY ?? require('crypto').randomBytes(8).toString("hex"),
          expiresAt: new Date('2099-12-31T23:59:59Z'),
        }],
      },
      config: {
        create: {
          allowLocalhost: true,
          oauthProviderConfigs: {
            create: (['github', 'facebook', 'google', 'microsoft'] as const).map((id) => ({
              id,
              proxiedOAuthConfig: {
                create: {                
                  type: id.toUpperCase() as any,
                }
              },
              projectUserOAuthAccounts: {
                create: []
              }
            })),
          },
          emailServiceConfig: {
            create: {
              proxiedEmailServiceConfig: {
                create: {}
              }
            }
          },
          credentialEnabled: true,
          magicLinkEnabled: true,
          signUpEnabled: true,
          createTeamOnSignUp: false,
        },
      },
    },
    update: {},
  });
  console.log('Internal project created');
  console.log('Seeding complete!');
}

seed().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
// eslint-disable-next-line @typescript-eslint/no-misused-promises, @typescript-eslint/return-await
}).finally(async () => await prisma.$disconnect());
