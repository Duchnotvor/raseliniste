import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "./ui/Button";

/**
 * Toggle pro malé obrazovky. Přidává/odebírá třídu `sidebar-open` na <html>,
 * CSS z Shell.astro podle ní sidebar posune z off-canvas do kontentu.
 */
export default function SidebarToggle() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (open) root.classList.add("sidebar-open");
    else root.classList.remove("sidebar-open");
  }, [open]);

  // Zavřít sidebar na click mimo nebo Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-sidebar]") || target.closest("[data-sidebar-toggle]")) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClickOutside);
    };
  }, [open]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setOpen((v) => !v)}
      aria-label={open ? "Zavřít menu" : "Otevřít menu"}
      data-sidebar-toggle
      className="lg:hidden"
    >
      {open ? <X /> : <Menu />}
    </Button>
  );
}
