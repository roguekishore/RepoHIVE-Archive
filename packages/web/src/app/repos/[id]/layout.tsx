import { redirect } from "next/navigation";
import { ActiveJobBannerWrapper as ActiveJobBanner } from "@/components/dashboard/active-job-banner-wrapper";
import { PageTransition } from "@/components/layout/page-transition";
import { ReindexHintBanner } from "@/components/layout/reindex-hint-banner";
import { RepoBreadcrumb } from "@/components/layout/repo-breadcrumb";
import { getRegistryRepo } from "@/lib/repohive/repo-registry";

interface RepoLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function RepoLayout({ children, params }: RepoLayoutProps) {
  const { id } = await params;
  const entry = getRegistryRepo(id);
  if (!entry) redirect("/");
  const repoName = entry.name;
  const docsMode: "none" = "none";
  return (
    <>
      <ReindexHintBanner repoId={id} />
      <ActiveJobBanner repoId={id} />
      <RepoBreadcrumb repoName={repoName} docsMode={docsMode ?? "none"} />
      <PageTransition>{children}</PageTransition>
    </>
  );
}
