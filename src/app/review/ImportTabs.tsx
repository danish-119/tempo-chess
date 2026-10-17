"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { setQuery } from "@/lib/url";
import { ChessComImport } from "@/components/import/ChessComImport";
import { LichessImport } from "@/components/import/LichessImport";
import { PgnImport } from "@/components/import/PgnImport";
import { Card, Tabs } from "@/components/ui/primitives";

type Tab = "chesscom" | "lichess" | "upload" | "paste";

const TABS: Tab[] = ["chesscom", "lichess", "upload", "paste"];

export function ImportTabs() {
  const params = useSearchParams();
  const fromUrl = params.get("tab") as Tab | null;
  const [tab, setTabState] = useState<Tab>(fromUrl && TABS.includes(fromUrl) ? fromUrl : "chesscom");
  const setTab = (t: Tab) => {
    setTabState(t);
    // Keep the address in sync; drop the other source's search.
    setQuery({ tab: t, user: null, month: null });
  };
  return (
    <div className="space-y-4">
      <Tabs<Tab>
        label="Import method"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "chesscom", label: "Chess.com" },
          { id: "lichess", label: "Lichess" },
          { id: "upload", label: "Upload PGN" },
          { id: "paste", label: "Paste PGN / link" },
        ]}
      />
      <Card className="p-4 sm:p-5" role="tabpanel" aria-label={tab}>
        {tab === "chesscom" ? <ChessComImport initialUser={params.get("user")} initialMonth={params.get("month")} /> : tab === "lichess" ? <LichessImport initialUser={params.get("user")} initialMonth={params.get("month")} /> : <PgnImport key={tab} mode={tab} />}
      </Card>
    </div>
  );
}
