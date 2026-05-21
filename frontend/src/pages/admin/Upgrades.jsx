import { useEffect, useState } from 'react';
import {
  Badge, Button, Group, Loader, Paper, Tabs, Table, Text, Modal, Stack, Textarea, Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

export default function AdminUpgrades() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [mode, setMode] = useState(null); // 'approve' | 'reject'

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/upgrade/admin/list', { params: { status_filter: tab } });
      setItems(r.data.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const openApprove = (item) => { setSelected(item); setMode('approve'); };
  const openReject = (item) => { setSelected(item); setMode('reject'); setRejectReason(''); };
  const close = () => { setSelected(null); setMode(null); };

  const doApprove = async () => {
    try {
      await api.post(`/api/upgrade/admin/${selected.id}/approve`, {});
      notifications.show({ color: 'teal', message: '승인 완료 — 사용자에게 이메일 발송됨' });
      close(); load();
    } catch (e) {
      notifications.show({ color: 'red', message: e?.response?.data?.detail || '실패' });
    }
  };

  const doReject = async () => {
    try {
      await api.post(`/api/upgrade/admin/${selected.id}/reject`, { reason: rejectReason });
      notifications.show({ color: 'orange', message: '반려 처리됨' });
      close(); load();
    } catch (e) {
      notifications.show({ color: 'red', message: e?.response?.data?.detail || '실패' });
    }
  };

  return (
    <>
      <AdminHeader title="등업 요청" subtitle="투자자 등업 신청 검토" />

      <Tabs value={tab} onChange={setTab} mb="md">
        <Tabs.List>
          <Tabs.Tab value="pending">대기</Tabs.Tab>
          <Tabs.Tab value="approved">승인</Tabs.Tab>
          <Tabs.Tab value="rejected">반려</Tabs.Tab>
          <Tabs.Tab value="all">전체</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Paper withBorder p="md" radius="md" bg="dark.7">
        {loading ? <Loader /> : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>신청일</Table.Th>
                <Table.Th>실명</Table.Th>
                <Table.Th>이메일</Table.Th>
                <Table.Th>전화</Table.Th>
                <Table.Th>회사</Table.Th>
                <Table.Th>목적</Table.Th>
                <Table.Th>상태</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((i) => (
                <Table.Tr key={i.id}>
                  <Table.Td>{formatDateTime(i.created_at)}</Table.Td>
                  <Table.Td>{i.realname}</Table.Td>
                  <Table.Td><Text size="sm">{i.email}</Text></Table.Td>
                  <Table.Td>{i.phone}</Table.Td>
                  <Table.Td>{i.company || '-'}</Table.Td>
                  <Table.Td><Text size="sm" lineClamp={2} maw={240}>{i.purpose}</Text></Table.Td>
                  <Table.Td>
                    <Badge color={i.status === 'approved' ? 'green' : i.status === 'rejected' ? 'red' : 'blue'}>
                      {i.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {i.status === 'pending' && (
                      <Group gap="xs">
                        <Button size="xs" color="green" leftSection={<IconCheck size={14} />} onClick={() => openApprove(i)}>승인</Button>
                        <Button size="xs" color="red" variant="light" leftSection={<IconX size={14} />} onClick={() => openReject(i)}>반려</Button>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
              {items.length === 0 && (
                <Table.Tr><Table.Td colSpan={8}><Text ta="center" c="dimmed">항목 없음</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal opened={mode === 'approve'} onClose={close} title="등업 승인" centered>
        {selected && (
          <Stack>
            <Text size="sm">
              <b>{selected.realname}</b> ({selected.email}) 을 투자자로 승격합니다.
              사용자에게 승인 이메일이 발송됩니다.
            </Text>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={close}>취소</Button>
              <Button color="green" onClick={doApprove}>승인</Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal opened={mode === 'reject'} onClose={close} title="등업 반려" centered>
        {selected && (
          <Stack>
            <Text size="sm">반려 사유를 입력해 주세요. (사용자에게 이메일로 전달됩니다)</Text>
            <Textarea minRows={4} value={rejectReason} onChange={(e) => setRejectReason(e.currentTarget.value)} />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={close}>취소</Button>
              <Button color="red" onClick={doReject} disabled={!rejectReason.trim()}>반려</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
