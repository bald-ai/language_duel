import { redirect } from "next/navigation";

export default async function OldRepetitionLaunchRedirect({
  params,
}: {
  params: Promise<{ goalId: string }>;
}) {
  const { goalId } = await params;
  redirect(`/repetition/${goalId}`);
}
