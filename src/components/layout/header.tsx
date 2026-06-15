"use client";

import { useRouter } from "next/navigation";
import { Avatar, Burger, Group, Menu, Text } from "@mantine/core";
import { useAuth } from "@/providers/auth-provider";
import { notifyError } from "@/lib/feedback";

export function Header({ navOpened, onToggleNav }: { navOpened: boolean; onToggleNav: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?"
    : "?";

  async function handleLogout() {
    try {
      await logout();
      router.replace("/login");
    } catch (err) {
      notifyError(err, "Déconnexion impossible");
    }
  }

  return (
    <Group h="100%" px="md" justify="space-between">
      <Group gap="sm">
        <Burger opened={navOpened} onClick={onToggleNav} hiddenFrom="sm" size="sm" />
        <Group gap="xs">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 font-bold text-white">
            L
          </div>
          <Text fw={600} size="lg">
            LacaÉducation
          </Text>
        </Group>
      </Group>

      <Menu position="bottom-end" withArrow shadow="md">
        <Menu.Target>
          <Group gap="sm" className="cursor-pointer">
            <div className="text-right">
              <Text size="sm" fw={500}>
                {user ? `${user.firstName} ${user.lastName}` : ""}
              </Text>
              <Text size="xs" c="dimmed">
                {user?.roles.join(", ")}
              </Text>
            </div>
            <Avatar color="indigo" radius="xl" size="md">
              {initials}
            </Avatar>
          </Group>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{user?.email}</Menu.Label>
          <Menu.Item color="red" onClick={handleLogout}>
            Déconnexion
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
