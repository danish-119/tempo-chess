import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSkeleton } from "@/components/ui/Skeleton";
import { AccountView } from "./AccountView";

export const metadata: Metadata = {
  title: "Your account",
  alternates: { canonical: "/account" },
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <Suspense fallback={<AccountSkeleton />}>
        <AccountView />
      </Suspense>
    </div>
  );
}
