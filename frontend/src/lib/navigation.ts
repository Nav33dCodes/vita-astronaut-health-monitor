import {
  BellRing,
  BookOpenCheck,
  LayoutDashboard,
  MonitorDot,
  Rocket,
  ScrollText,
  Server,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Sidebar, mobile tab bar, breadcrumbs and command-palette navigation: one source of truth. */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: "alerts";
  /** Second key of the "g then …" shortcut. */
  key: string;
  /** Shown in the mobile bottom tab bar. */
  primary?: boolean;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Monitoring",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard, key: "o", primary: true },
      { href: "/monitor", label: "Live monitor", icon: MonitorDot, key: "m", primary: true },
      { href: "/hazards", label: "Hazards", icon: ShieldAlert, key: "h" },
      { href: "/alerts", label: "Alerts", icon: BellRing, badge: "alerts", key: "a", primary: true },
      { href: "/events", label: "Event log", icon: ScrollText, key: "e" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/crew", label: "Crew", icon: Users, key: "c", primary: true },
      { href: "/missions", label: "Missions", icon: Rocket, key: "i" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/protocols", label: "Protocols", icon: BookOpenCheck, key: "p" },
      { href: "/system", label: "System status", icon: Server, key: "s" },
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export const isActivePath = (href: string, pathname: string | null) =>
  pathname !== null && (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

/** The nav item a path belongs to (for breadcrumbs). */
export const navItemFor = (pathname: string | null) => NAV_ITEMS.find((item) => isActivePath(item.href, pathname));
