import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AppShell, Burger, Group, Text, NavLink, Badge, Avatar, Menu, Box, Divider, Button, ScrollArea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconLayoutDashboard, IconUsers, IconMapPin, IconBrain, IconMail,
  IconPuzzle, IconPlug, IconBook, IconActivity, IconLogout, IconSettings,
} from '@tabler/icons-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../../lib/api.js';
import { roleLabel } from '../../lib/format.js';

const MENU = [
  { to: '/admin', label: '대시보드', icon: IconLayoutDashboard, end: true },
  { to: '/admin/users', label: '사용자 관리', icon: IconUsers },
  { to: '/admin/parcels', label: '필지 관리', icon: IconMapPin },
  { to: '/admin/ai-logs', label: 'AI 로그', icon: IconBrain },
  { to: '/admin/emails', label: '이메일 이력', icon: IconMail },
  { to: '/admin/skills', label: 'AI 스킬', icon: IconPuzzle },
  { to: '/admin/plugins', label: '플러그인', icon: IconPlug },
  { to: '/admin/docs', label: '프로젝트 문서', icon: IconBook },
  { to: '/admin/ops', label: '운영 모니터', icon: IconActivity },
];

export default function AdminLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const { user, logout } = useAuth();
  const [pending, setPending] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // 등업 요청 폴링 제거 (TwinLand 는 reports 기반)
  }, []);

  const onLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text component={Link} to="/" fw={700} c="white" style={{ textDecoration: 'none' }}>
              ◐ JooJooLand Admin
            </Text>
          </Group>

          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <Group gap="xs" style={{ cursor: 'pointer' }}>
                <Avatar color="joojoo" radius="xl" size="sm">
                  {(user?.display_name || user?.email || '?').charAt(0).toUpperCase()}
                </Avatar>
                <Box visibleFrom="sm">
                  <Text size="sm" c="white">{user?.display_name || user?.email}</Text>
                  <Text size="xs" c="dimmed">{roleLabel(user?.role)}</Text>
                </Box>
              </Group>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconSettings size={16} />} component={Link} to="/" onClick={close}>
                공개 사이트로
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<IconLogout size={16} />} color="red" onClick={onLogout}>
                로그아웃
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <ScrollArea style={{ flex: 1 }}>
          {MENU.map((item) => {
            const Icon = item.icon;
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                component={Link}
                to={item.to}
                label={item.label}
                leftSection={<Icon size={18} stroke={1.6} />}
                rightSection={
                  item.badge === 'pending' && pending > 0 ? (
                    <Badge size="xs" color="red">{pending}</Badge>
                  ) : null
                }
                active={active}
                onClick={close}
              />
            );
          })}
        </ScrollArea>
        <Divider my="xs" />
        <Button variant="subtle" color="red" leftSection={<IconLogout size={16} />} onClick={onLogout} fullWidth>
          로그아웃
        </Button>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
