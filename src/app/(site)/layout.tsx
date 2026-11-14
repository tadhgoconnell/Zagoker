import { SiteFooter } from "@/components/layout/site-footer";

/** Ordinary pages get the footer. The poker table (outside this group) does not. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </>
  );
}
