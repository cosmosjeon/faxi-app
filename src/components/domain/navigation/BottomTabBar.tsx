"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, PlusCircle, Printer, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    href: "/home",
    label: "홈",
    icon: Home,
  },
  {
    href: "/friends",
    label: "친구",
    icon: Users,
  },
  {
    href: "/compose",
    label: "전송",
    icon: PlusCircle,
  },
  {
    href: "/printer",
    label: "프린터",
    icon: Printer,
  },
  {
    href: "/profile",
    label: "프로필",
    icon: User,
  },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-colors",
                isActive
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon
                size={20}
                className={cn(isActive ? "text-blue-600" : "text-gray-500")}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive ? "text-blue-600" : "text-gray-500"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
