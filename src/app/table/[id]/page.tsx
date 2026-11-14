import type { Metadata } from "next";
import { Suspense } from "react";
import { TableClient } from "@/components/table/table-client";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Table" };

export default function TablePage(props: PageProps<"/table/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center" aria-busy="true">
          <div className="size-10 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
        </div>
      }
    >
      <Table params={props.params} />
    </Suspense>
  );
}

async function Table({ params }: { params: PageProps<"/table/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/table/${id}`);
  return <TableClient tableId={id} userId={user.id} />;
}
