import {
  BellRing,
  BookOpenCheck,
  LayoutDashboard,
  MonitorDot,
  Rocket,
  ScrollText,
  Server,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Sidebar and command-palette navigation — one source of truth. */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: "alerts";
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Monitoring",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/monitor", label: "Live Monitor", icon: MonitorDot },
      { href: "/alerts", label: "Alerts", icon: BellRing, badge: "alerts" },
      { href: "/events", label: "Event Log", icon: ScrollText },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/crew", label: "Crew", icon: Users },
      { href: "/missions", label: "Missions", icon: Rocket },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/protocols", label: "Protocols", icon: BookOpenCheck },
      { href: "/system", label: "System Status", icon: Server },
    ],
  },
];
