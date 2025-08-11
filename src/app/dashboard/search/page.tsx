import { Suspense } from "react";
import SearchClient from "./search-client";

export const dynamic = "force-dynamic"; // avoid prerender issues

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4">Loading search…</div>}>
      <SearchClient />
    </Suspense>
  );
}
