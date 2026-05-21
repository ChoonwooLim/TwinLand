import { useEffect, useState } from 'react';
import { Badge, Button, Group, Loader, Paper, Select, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconRefresh } from '@tabler/icons-react';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

const STATUS_COLOR = { sent: 'green', queued: 'blue', logged: 'gray', failed: 'red' };

export default function AdminEmails() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/emails', { params: { status } });
      setItems(r.data.items);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const resend = async (id) => {
    try {
      await api.post(`/api/admin/emails/${id}/resend`);
      notifications.show({ color: 'teal', message: '재전송 완료' });
      load();
    } catch (e) {
      notifications.show({ color: 'red', message: e?.response?.data?.detail || '실패' });
    }
  };

  return (
    <>
      <AdminHeader title="이메일 이력" subtitle="발송 로그 및 재전송" />

      <Paper withBorder p="md" radius="md" bg="dark.7" mb="md">
        <Group>
          <Select
            label="상태"
            data={[
              { value: 'all', label: '전체' },
              { value: 'sent', label: 'sent' },
              { value: 'logged', label: 'logged (API 키 미설정)' },
              { value: 'queued', label: 'queued' },
              { value: 'failed', label: 'failed' },
            ]}
            value={status}
            onChange={(v) => v && setStatus(v)}
            w={240}
          />
        </Group>
      </Paper>

      <Paper withBorder p="md" radius="md" bg="dark.7">
        {loading ? <Loader /> : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>시각</Table.Th>
                <Table.Th>수신자</Table.Th>
                <Table.Th>템플릿</Table.Th>
                <Table.Th>제목</Table.Th>
                <Table.Th>상태</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((e) => (
                <Table.Tr key={e.id}>
                  <Table.Td>{formatDateTime(e.created_at)}</Table.Td>
                  <Table.Td><Text size="sm">{e.to_email}</Text></Table.Td>
                  <Table.Td><Badge variant="light">{e.template}</Badge></Table.Td>
                  <Table.Td><Text size="sm" lineClamp={1}>{e.subject}</Text></Table.Td>
                  <Table.Td><Badge color={STATUS_COLOR[e.status] || 'gray'}>{e.status}</Badge></Table.Td>
                  <Table.Td>
                    <Button size="xs" leftSection={<IconRefresh size={14} />} onClick={() => resend(e.id)}>재전송</Button>
                  </Table.Td>
                </Table.Tr>
              ))}
              {items.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" ta="center">이력 없음</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </>
  );
}
