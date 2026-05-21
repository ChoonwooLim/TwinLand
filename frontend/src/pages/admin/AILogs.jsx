import { useEffect, useState } from 'react';
import { Group, Loader, Paper, Table, Text, TextInput, Button } from '@mantine/core';
import { BarChart } from '@mantine/charts';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

export default function AdminAILogs() {
  const [items, setItems] = useState([]);
  const [byModel, setByModel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState('');
  const [session, setSession] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/ai-logs', { params: { model: model || undefined, session_id: session || undefined } });
      setItems(r.data.items);
      setByModel(r.data.by_model);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <>
      <AdminHeader title="AI 채팅 로그" subtitle="OpenClaw 에이전트 호출 기록" />

      {byModel.length > 0 && (
        <Paper withBorder p="md" radius="md" bg="dark.7" mb="md">
          <Text fw={600} c="white" mb="sm">모델별 호출 횟수</Text>
          <BarChart h={180} data={byModel} dataKey="model" series={[{ name: 'count', color: 'joojoo.5' }]} />
        </Paper>
      )}

      <Paper withBorder p="md" radius="md" bg="dark.7" mb="md">
        <Group>
          <TextInput label="모델" placeholder="anthropic/claude-opus-4-7" value={model} onChange={(e) => setModel(e.currentTarget.value)} />
          <TextInput label="세션 ID" value={session} onChange={(e) => setSession(e.currentTarget.value)} />
          <Button onClick={load} style={{ alignSelf: 'flex-end' }}>조회</Button>
        </Group>
      </Paper>

      <Paper withBorder p="md" radius="md" bg="dark.7">
        {loading ? <Loader /> : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>시각</Table.Th>
                <Table.Th>세션</Table.Th>
                <Table.Th>모델</Table.Th>
                <Table.Th>에이전트</Table.Th>
                <Table.Th>입력</Table.Th>
                <Table.Th>출력</Table.Th>
                <Table.Th>지연</Table.Th>
                <Table.Th>에러</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>{formatDateTime(l.created_at)}</Table.Td>
                  <Table.Td><Text size="xs" ff="monospace">{l.session_id?.slice(0, 12)}</Text></Table.Td>
                  <Table.Td>{l.model}</Table.Td>
                  <Table.Td>{l.agent_id}</Table.Td>
                  <Table.Td>{l.prompt_chars}</Table.Td>
                  <Table.Td>{l.response_chars}</Table.Td>
                  <Table.Td>{l.latency_ms}ms</Table.Td>
                  <Table.Td>{l.error ? <Text c="red" size="xs">{l.error.slice(0, 40)}</Text> : '-'}</Table.Td>
                </Table.Tr>
              ))}
              {items.length === 0 && <Table.Tr><Table.Td colSpan={8}><Text c="dimmed" ta="center">로그 없음</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </>
  );
}
