"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLink, ScrollArea, Text } from "@mantine/core";
import { NAVIGATION } from "@/config/navigation";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const pathname = usePathname();

  const sections = NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || hasRole(user, ...item.roles)),
  })).filter((section) => section.items.length > 0);

  return (
    <ScrollArea type="scroll" className="h-full">
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" px="xs" pb={4}>
              {section.title}
            </Text>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <NavLink
                  key={item.href}
                  component={Link}
                  href={item.href}
                  label={item.label}
                  active={active}
                  onClick={onNavigate}
                  variant="light"
                />
              );
            })}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
