import { useEffect, useState } from 'react';
import {
  Button, Drawer, Group, Loader, NumberInput, Paper, Select, Stack, Table, Text, Textarea, TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconPlus, IconTrash, IconEdit } from '@tabler/icons-react';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';

const STATUS = [
  { value: 'available', label: '보유' },
  { value: 'pending', label: '협의중' },
  { value: 'contracted', label: '계약' },
  { value: 'excluded', label: '제외' },
];

const blank = { id: null, code: '', name: '', zone: '', area_sqm: null, geometry_geojson: '', status: 'available' };

export default function AdminParcels() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/parcels');
      setItems(r.data.items);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const payload = {
      code: editing.code,
      name: editing.name || null,
      zone: editing.zone || null,
      area_sqm: editing.area_sqm,
      geometry_geojson: editing.geometry_geojson || null,
      status: editing.status,
    };
    try {
      if (editing.id) {
        await api.put(`/api/admin/parcels/${editing.id}`, payload);
      } else {
        await api.post('/api/admin/parcels', payload);
      }
      notifications.show({ color: 'teal', message: '저장됨' });
      setEditing(null); load();
    } catch (e) {
      notifications.show({ color: 'red', message: e?.response?.data?.detail || '실패' });
    }
  };

  const remove = (p) => {
    modals.openConfirmModal({
      title: '부지 삭제',
      children: <Text size="sm">{p.code} — {p.name || ''} 삭제</Text>,
      labels: { confirm: '삭제', cancel: '취소' },
      confirmProps: { color: 'red' },
      onConfirm: async () => { await api.delete(`/api/admin/parcels/${p.id}`); load(); },
    });
  };

  return (
    <>
      <AdminHeader
        title="부지 관리"
        subtitle="지번별 필지 정보 · 지도 필터링용"
        action={<Button leftSection={<IconPlus size={16} />} onClick={() => setEditing({ ...blank })}>추가</Button>}
      />

      <Paper withBorder p="md" radius="md" bg="dark.7">
        {loading ? <Loader /> : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>코드 (지번)</Table.Th>
                <Table.Th>이름</Table.Th>
                <Table.Th>용도</Table.Th>
                <Table.Th>면적 (㎡)</Table.Th>
                <Table.Th>상태</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td><Text size="sm" ff="monospace">{p.code}</Text></Table.Td>
                  <Table.Td>{p.name || '-'}</Table.Td>
                  <Table.Td>{p.zone || '-'}</Table.Td>
                  <Table.Td>{p.area_sqm?.toLocaleString() || '-'}</Table.Td>
                  <Table.Td>{p.status}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" leftSection={<IconEdit size={14} />} onClick={() => setEditing({ ...p })}>편집</Button>
                      <Button size="xs" color="red" variant="light" leftSection={<IconTrash size={14} />} onClick={() => remove(p)}>삭제</Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {items.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" ta="center">부지 없음</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Drawer opened={!!editing} onClose={() => setEditing(null)} position="right" size="lg" title={editing?.id ? '부지 편집' : '새 부지'}>
        {editing && (
          <Stack>
            <TextInput label="지번 코드" required value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.currentTarget.value })} />
            <TextInput label="이름" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.currentTarget.value })} />
            <TextInput label="용도지역 (예: 농림)" value={editing.zone || ''} onChange={(e) => setEditing({ ...editing, zone: e.currentTarget.value })} />
            <NumberInput label="면적 (㎡)" value={editing.area_sqm ?? ''} onChange={(v) => setEditing({ ...editing, area_sqm: typeof v === 'number' ? v : null })} />
            <Select label="상태" data={STATUS} value={editing.status} onChange={(v) => v && setEditing({ ...editing, status: v })} />
            <Textarea label="GeoJSON" value={editing.geometry_geojson || ''} onChange={(e) => setEditing({ ...editing, geometry_geojson: e.currentTarget.value })} autosize minRows={4} maxRows={12} />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setEditing(null)}>취소</Button>
              <Button onClick={save}>저장</Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </>
  );
}
