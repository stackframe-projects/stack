'use client';
import { AuthPage, useUser } from "@stackframe/stack";
import * as yup from "yup";
import { Separator } from "@/components/ui/separator";
import { yupResolver } from "@hookform/resolvers/yup";
import { Form } from "@/components/ui/form";
import { InputField, SwitchListField } from "@/components/form-fields";
import { runAsynchronously, runAsynchronouslyWithAlert, wait } from "@stackframe/stack-shared/dist/utils/promises";
import { useRouter } from "@/components/router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import Typography from "@/components/ui/typography";
import { toSharedProvider } from "@stackframe/stack-shared/dist/interface/clientInterface";
import { BrowserFrame } from "@/components/browser-frame";
import { useForm } from "react-hook-form";

export const projectFormSchema = yup.object({
  displayName: yup.string().min(1, "Project name is required").required(),
  signInMethods: yup.array(yup.string().oneOf(["google", "github", "microsoft", "facebook", "credential", "magicLink"]).required()).required(),
});

export type ProjectFormValues = yup.InferType<typeof projectFormSchema>

export const defaultValues: Partial<ProjectFormValues> = {
  displayName: "",
  signInMethods: ["credential", "google", "github"],
};

export default function PageClient () {
  const user = useUser({ or: 'redirect', projectIdMustMatch: "internal" });
  const [loading, setLoading] = useState(false);
  const form = useForm<ProjectFormValues>({
    resolver: yupResolver<ProjectFormValues>(projectFormSchema),
    defaultValues,
    mode: "onChange",
  });
  const router = useRouter();

  const mockProject = {
    id: "id",
    credentialEnabled: form.watch("signInMethods").includes("credential"),
    magicLinkEnabled: form.watch("signInMethods").includes("magicLink"),
    signUpEnabled:true,
    oauthProviders: (["google", "facebook", "github", "microsoft"] as const).map(provider => ({
      id: provider,
      enabled: form.watch("signInMethods").includes(provider),
    })),
  };

  const onSubmit = async (values: ProjectFormValues, e?: React.BaseSyntheticEvent) => {
    e?.preventDefault();
    setLoading(true);
    let newProject;
    try {
      newProject = await user.createProject({
        displayName: values.displayName,
        config: {
          credentialEnabled: values.signInMethods.includes("credential"),
          magicLinkEnabled: values.signInMethods.includes("magicLink"),
          signUpEnabled:true,
          oauthProviders: (["google", "facebook", "github", "microsoft"] as const).map(provider => ({
            id: provider,
            enabled: values.signInMethods.includes(provider),
            type: toSharedProvider(provider),
          })).filter(({ enabled }) => enabled),
        }
      });
      router.push('/projects/' + newProject.id);
      await wait(2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex-grow flex items-center justify-center">
      <div className="w-full md:w-1/2 p-4">
        <div className='max-w-xs m-auto'>
          <div className="flex justify-center mb-4">
            <Typography type='h2'>Create a new project</Typography>
          </div>
            
          <Form {...form}>
            <form onSubmit={e => runAsynchronouslyWithAlert(form.handleSubmit(onSubmit)(e))} className="space-y-4">

              <InputField required control={form.control} name="displayName" label="Project Name" placeholder="My Project" />

              <SwitchListField
                control={form.control}
                name="signInMethods"
                label="Sign-In Methods"
                options={[
                  { value: "credential", label: "Email password" },
                  { value: "magicLink", label: "Magic link" },
                  { value: "google", label: "Google" },
                  { value: "github", label: "GitHub" },
                  { value: "microsoft", label: "Microsoft" },
                  { value: "facebook", label: "Facebook" },
                ]}
              />

              <div className="flex justify-center">
                <Button loading={loading} type="submit">Create project</Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
      <Separator orientation="vertical" />

      <div className="w-1/2 self-stretch py-4 px-4 lg:px-20 bg-zinc-300 dark:bg-zinc-800 hidden md:flex items-center">
        {
          (
            <div className="w-full">
              <BrowserFrame url="your-website.com/signin">
                <div className="flex flex-col items-center justify-center min-h-[400px]">
                  <div className='w-full sm:max-w-xs m-auto scale-90' inert=''>
                    {/* a transparent cover that prevents the card being clicked */}
                    <div className="absolute inset-0 bg-transparent z-10"></div>
                    <AuthPage 
                      type="sign-in" 
                      mockProject={mockProject} 
                    />
                  </div>
                </div>
              </BrowserFrame>
            </div>
          )}
      </div> 
    </div>
  );
}
