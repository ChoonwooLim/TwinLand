import { useEffect, useState } from 'react';
import { Badge, Card, Grid, Group, Loader, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { AreaChart } from '@mantine/charts';
import {
  IconUsers, IconUserCheck, IconAddressBook, IconFolder, IconDownload, IconBrain,
} from '@tabler/icons-react';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime, stageLabel } from '../../lib/format.js';

const cards = [
  { key: 'total_users', label: '전체 회원', icon: IconUsers, color: 'blue' },
  { key: 'total_investors', label: '투자자', icon: IconUserCheck, color: 'green' },
  { key: 'pending_upgrades', label: '등업 대기', icon: IconUserCheck, color: 'orange' },
  { key: 'total_leads', label: '전체 리드', icon: IconAddressBook, color: 'cyan' },
  { key: 'new_leads_week', label: '신규 리드(주)', icon: IconAddressBook, color: 'teal' },
  { key: 'total_docs', label: 'DataRoom 문서', icon: IconFolder, color: 'violet' },
  { key: 'downloads_week', label: '다운로드(주)', icon: IconDownload, color: 'pink' },
  { key: 'ai_chats_week', label: 'AI 채팅(주)', icon: IconBrain, color: 'grape' },
];

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/api/admin/dashboard').then((r) => setData(r.data)).catch(() => setData({ stats: {}, daily: [], recent_leads: [], recent_upgrades: [] }));
  }, []);

  if (!data) return <Loader />;

  return (
    <>
      <AdminHeader title="대시보드" subtitle="운영 현황 요약" />

      <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md" mb="lg">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.key} withBorder p="md" radius="md" bg="dark.7">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{c.label}</Text>
                <Icon size={18} color={`var(--mantine-color-${c.color}-4)`} />
              </Group>
              <Text fz={28} fw={700} c="white" mt={4}>
                {data.stats?.[c.key] ?? 0}
              </Text>
            </Card>
          );
        })}
      </SimpleGrid>

      <Paper withBorder p="md" radius="md" bg="dark.7" mb="lg">
        <Text fw={600} c="white" mb="sm">최근 7일 — 리드 / 다운로드</Text>
        <AreaChart
          h={240}
          data={data.daily || []}
          dataKey="date"
          series={[
            { name: 'leads', color: 'joojoo.5', label: '리드' },
            { name: 'downloads', color: 'pink.5', label: '다운로드' },
          ]}
          curveType="linear"
          withGradient
          withLegend
        />
      </Paper>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper withBorder p="md" radius="md" bg="dark.7">
            <Text fw={600} c="white" mb="sm">최근 리드</Text>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>이메일</Table.Th>
                  <Table.Th>이름</Table.Th>
                  <Table.Th>단계</Table.Th>
                  <Table.Th>등록</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(data.recent_leads || []).map((l) => (
                  <Table.Tr key={l.id}>
                    <Table.Td>{l.email}</Table.Td>
                    <Table.Td>{l.name || '-'}</Table.Td>
                    <Table.Td><Badge size="xs">{stageLabel(l.stage)}</Badge></Table.Td>
                    <Table.Td>{formatDateTime(l.created_at)}</Table.Td>
                  </Table.Tr>
                ))}
                {(data.recent_leads || []).length === 0 && (
                  <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center">리드 없음</Text></Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper withBorder p="md" radius="md" bg="dark.7">
            <Text fw={600} c="white" mb="sm">대기중 등업</Text>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>실명</Table.Th>
                  <Table.Th>전화</Table.Th>
                  <Table.Th>회사</Table.Th>
                  <Table.Th>신청일</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(data.recent_upgrades || []).map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td>{u.realname}</Table.Td>
                    <Table.Td>{u.phone}</Table.Td>
                    <Table.Td>{u.company || '-'}</Table.Td>
                    <Table.Td>{formatDateTime(u.created_at)}</Table.Td>
                  </Table.Tr>
                ))}
                {(data.recent_upgrades || []).length === 0 && (
                  <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center">대기 없음</Text></Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Paper>
        </Grid.Col>
      </Grid>
    </>
  );
}
