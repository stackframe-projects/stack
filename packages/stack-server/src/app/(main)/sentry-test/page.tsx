import { cookies } from "next/headers";

export async function SentryTestPage() {
  cookies();
  throw new Error('Sentry test error');

  return <></>;
}
