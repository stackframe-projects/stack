"use client";
import { useAdminApp } from "../use-admin-app";
import { ProviderSettingSwitch, availableProviders } from "./providers";
import { OAuthProviderConfigJson } from "@stackframe/stack-shared";
import { PageLayout } from "../page-layout";
import { SettingCard, SettingSwitch } from "@/components/settings";

export default function PageClient() {
  const stackAdminApp = useAdminApp();
  const project = stackAdminApp.useProjectAdmin();
  const oauthProviders = project.evaluatedConfig.oauthProviders;

  return (
    <PageLayout title="Auth Methods" description="Configure how users can sign in to your app">
      <SettingCard title="Email Authentication" description="Email address based sign in.">
        <SettingSwitch
          label="Email password authentication"
          checked={project.evaluatedConfig.credentialEnabled}
          onCheckedChange={async (checked) => {
            await project.update({
              config: {
                credentialEnabled: checked,
              },
            });
          }}
        />
        <SettingSwitch
          label="Magic link (email with login link)"
          checked={project.evaluatedConfig.magicLinkEnabled}
          onCheckedChange={async (checked) => {
            await project.update({
              config: {
                magicLinkEnabled: checked,
              },
            });
          }}
        />
      </SettingCard>

      <SettingCard title="OAuth Providers" description={`The "Sign in with XYZ" buttons on your app.`}>
        {availableProviders.map((id) => {
          const provider = oauthProviders.find((provider) => provider.id === id);
          return <ProviderSettingSwitch 
            key={id} 
            id={id} 
            provider={provider}
            updateProvider={async (provider: OAuthProviderConfigJson) => {
              const alreadyExist = oauthProviders.some((p) => p.id === id);
              const newOAuthProviders = oauthProviders.map((p) => p.id === id ? provider : p);
              if (!alreadyExist) {
                newOAuthProviders.push(provider);
              }
              await project.update({
                config: { oauthProviders: newOAuthProviders },
              });
            }}
          />;
        })}
      </SettingCard>

      <SettingCard title="User Settings" description="Toggle to enable/disable new User Sign-up">
      <SettingSwitch
        label="Signup"
        checked={project.evaluatedConfig.signUpEnabled}
        onCheckedChange={async (checked) => {
          await project.update({
            config: {
              signUpEnabled: checked,
            },
          });
        }}
      />
    </SettingCard>
    </PageLayout >
  );
}
