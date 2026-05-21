import { useEffect, useState } from 'react';
import {
  Badge, Button, Drawer, Group, Loader, Paper, Select, Stack, Table, Text, Textarea, TextInput, Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconTrash, IconEdit } from '@tabler/icons-react';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime, stageColor, stageLabel } from '../../lib/format.js';

const STAGES = ['new', 'contacting', 'meeting', 'diligence', 'contract', 'hold', 'closed'];

export default function AdminLeads() {
  const [items, setItems] = useState([]);
  const [stages, setStages] = useState(STAGES);
  const [stageFilter, setStageFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [draftStage, setDraftStage] = useState('new');
  const [draftMemo, setDraftMemo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/leads/admin', { params: { stage: stageFilter } });
      setItems(r.data.items);
      setStages(r.data.stages || STAGES);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [stageFilter]);

  const openDetail = (l) => {
    setActive(l);
    setDraftStage(l.stage);
    setDraftMemo(l.memo || '');
  };

  const save = async () => {
    if (!active) return;
    try {
      await api.put(`/api/leads/admin/${active.id}`, { stage: draftStage, memo: draftMemo });
      notifications.show({ color: 'teal', message: '저장됨' });
      setActive(null); load();
    } catch (e) {
      notifications.show({ color: 'red', message: e?.response?.data?.detail || '실패' });
    }
  };

  const remove = (l) => {
    modals.openConfirmModal({
      title: '리드 삭제',
      children: <Text size="sm">{l.email} 을 삭제합니다</Text>,
      labels: { confirm: '삭제', cancel: '취소' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await api.delete(`/api/leads/admin/${l.id}`);
        load();
      },
    });
  };

  return (
    <>
      <AdminHeader title="투자자 리드" subtitle="Contact 폼 제출 / 대기자 / 리퍼럴" />

      <Paper withBorder p="md" radius="md" bg="dark.7" mb="md">
        <Group>
          <Select
            data={[{ value: 'all', label: '전체' }, ...stages.map((s) => ({ value: s, label: stageLabel(s) }))]}
            value={stageFilter}
            onChange={setStageFilter}
            w={160}
            label="단계"
          />
        </Group>
      </Paper>

      <Paper withBorder p="md" radius="md" bg="dark.7">
        {loading ? <Loader /> : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>등록일</Table.Th>
                <Table.Th>이메일</Table.Th>
                <Table.Th>이름</Table.Th>
                <Table.Th>회사</Table.Th>
                <Table.Th>소스</Table.Th>
                <Table.Th>단계</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>{formatDateTime(l.created_at)}</Table.Td>
                  <Table.Td><Text size="sm">{l.email}</Text></Table.Td>
                  <Table.Td>{l.name || '-'}</Table.Td>
                  <Table.Td>{l.company || '-'}</Table.Td>
                  <Table.Td><Badge variant="light">{l.source}</Badge></Table.Td>
                  <Table.Td><Badge color={stageColor(l.stage)}>{stageLabel(l.stage)}</Badge></Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" leftSection={<IconEdit size={14} />} onClick={() => openDetail(l)}>상세</Button>
                      <Button size="xs" color="red" variant="light" leftSection={<IconTrash size={14} />} onClick={() => remove(l)}>삭제</Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {items.length === 0 && <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center">리드 없음</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Drawer opened={!!active} onClose={() => setActive(null)} title={active && `리드 #${active.id}`} position="right" size="md">
        {active && (
          <Stack>
            <TextInput label="이메일" value={active.email} readOnly />
            <TextInput label="이름" value={active.name || ''} readOnly />
            <TextInput label="회사" value={active.company || ''} readOnly />
            <TextInput label="전화" value={active.phone || ''} readOnly />
            <Textarea label="메시지" value={active.message || ''} readOnly minRows={3} />
            <Select
              label="단계"
              data={stages.map((s) => ({ value: s, label: stageLabel(s) }))}
              value={draftStage}
              onChange={(v) => v && setDraftStage(v)}
            />
            <Textarea label="내부 메모" value={draftMemo} onChange={(e) => setDraftMemo(e.currentTarget.value)} minRows={4} />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setActive(null)}>취소</Button>
              <Button onClick={save}>저장</Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </>
  );
}
