import { useEffect, useState } from 'react';
import {
  Badge, Button, Group, Loader, Paper, Select, Switch, Table, Text, TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconSearch, IconTrash } from '@tabler/icons-react';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime, roleLabel } from '../../lib/format.js';
import { useAuth } from '../../features/auth/AuthContext.jsx';

const ROLES = ['guest', 'investor', 'admin', 'superadmin'];

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/users', { params: { q: q || undefined, role: roleFilter } });
      setUsers(r.data.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [roleFilter]);

  const onChangeRole = async (uid, newRole) => {
    try {
      await api.put(`/api/admin/users/${uid}/role`, { role: newRole });
      notifications.show({ color: 'teal', message: '역할 변경됨' });
      load();
    } catch (e) {
      notifications.show({ color: 'red', message: e?.response?.data?.detail || '변경 실패' });
    }
  };

  const onToggleActive = async (uid, active) => {
    try {
      await api.put(`/api/admin/users/${uid}/active`, { is_active: active });
      load();
    } catch (e) {
      notifications.show({ color: 'red', message: e?.response?.data?.detail || '변경 실패' });
    }
  };

  const onDelete = (uid, email) => {
    modals.openConfirmModal({
      title: '사용자 삭제',
      children: <Text size="sm">{email} 계정을 삭제합니다. 복구 불가합니다.</Text>,
      labels: { confirm: '삭제', cancel: '취소' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(`/api/admin/users/${uid}`);
          notifications.show({ color: 'teal', message: '삭제됨' });
          load();
        } catch (e) {
          notifications.show({ color: 'red', message: e?.response?.data?.detail || '실패' });
        }
      },
    });
  };

  const canChangeRole = (target) => {
    if (me.role !== 'superadmin' && (target.role === 'admin' || target.role === 'superadmin')) return false;
    return true;
  };

  return (
    <>
      <AdminHeader title="사용자 관리" subtitle={`총 ${users.length}명`} />

      <Paper withBorder p="md" radius="md" bg="dark.7" mb="md">
        <Group>
          <TextInput
            placeholder="이메일/이름 검색"
            leftSection={<IconSearch size={16} />}
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            style={{ flex: 1 }}
          />
          <Select
            data={[{ value: 'all', label: '전체 역할' }, ...ROLES.map((r) => ({ value: r, label: roleLabel(r) }))]}
            value={roleFilter}
            onChange={setRoleFilter}
            w={160}
          />
          <Button onClick={load}>조회</Button>
        </Group>
      </Paper>

      <Paper withBorder p="md" radius="md" bg="dark.7">
        {loading ? <Loader /> : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>이메일</Table.Th>
                <Table.Th>이름</Table.Th>
                <Table.Th>역할</Table.Th>
                <Table.Th>회사</Table.Th>
                <Table.Th>전화</Table.Th>
                <Table.Th>활성</Table.Th>
                <Table.Th>가입일</Table.Th>
                <Table.Th>최근로그인</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((u) => (
                <Table.Tr key={u.id}>
                  <Table.Td><Text size="sm">{u.email}</Text></Table.Td>
                  <Table.Td>{u.display_name || '-'}</Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      data={ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
                      value={u.role}
                      onChange={(v) => v && v !== u.role && onChangeRole(u.id, v)}
                      disabled={!canChangeRole(u) || u.id === me.id}
                      w={110}
                    />
                  </Table.Td>
                  <Table.Td>{u.company || '-'}</Table.Td>
                  <Table.Td>{u.phone || '-'}</Table.Td>
                  <Table.Td>
                    <Switch
                      checked={u.is_active}
                      onChange={(e) => onToggleActive(u.id, e.currentTarget.checked)}
                      disabled={u.id === me.id}
                    />
                  </Table.Td>
                  <Table.Td>{formatDateTime(u.created_at)}</Table.Td>
                  <Table.Td>{formatDateTime(u.last_login_at)}</Table.Td>
                  <Table.Td>
                    <Button
                      size="xs" color="red" variant="light"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => onDelete(u.id, u.email)}
                      disabled={u.id === me.id || u.role === 'superadmin'}
                    >삭제</Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </>
  );
}
