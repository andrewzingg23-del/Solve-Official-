"use client";

// Reads the room again every minute while it is on screen, so builds and pull requests on GitHub show
// up without a reload. Kernel changes arrive sooner through the World's live connection.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RoomRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(tick);
  }, [router, seconds]);
  return null;
}
