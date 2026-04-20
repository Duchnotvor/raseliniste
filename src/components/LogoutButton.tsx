import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "./ui/Button";

export default function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={pending}
      aria-label="Odhlásit"
      title="Odhlásit"
    >
      {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
    </Button>
  );
}
