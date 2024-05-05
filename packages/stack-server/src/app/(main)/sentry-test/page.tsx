import { cookies } from "next/headers";

export default async function SentryTestPage() {
  cookies();
  if (Math.random() < 2) {
    throw new Error('Sentry test error. ' + JSON.stringify(process.env.CI));
  }

  return <></>;
}
