"use client";

import { useSettings } from "@/components/providers/SettingsProvider";
import { Dialog } from "@/components/ui/Dialog";
import { SettingsView } from "./SettingsView";

/** App-wide settings modal, opened from the header gear or the footer link. */
export function SettingsDialog() {
  const { settingsOpen, closeSettings } = useSettings();
  return (
    <Dialog open={settingsOpen} onClose={closeSettings} title="Settings">
      <SettingsView />
    </Dialog>
  );
}
