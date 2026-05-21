import { useEffect, useState } from 'react';
import { Badge, Button, Card, Code, Grid, Group, Loader, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconRefresh } from '@tabler/icons-react';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';

export default function AdminOps() {
  const [data, setData] = useState(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  const load = () => api.get('/api/admin/ops').then((r) => setData(r.data));
  useEffect(() => { load(); }, []);

  const doPing = async () => {
    setPingLoading(true);
    try {
      const r = await api.get('/api/admin/ops/openclaw/ping');
      setPingResult(r.data);
      notifications.show({ color: r.data.ok ? 'teal' : 'red', message: r.data.ok ? 'OpenClaw 응답 OK' : `실패: ${r.data.error?.slice(0, 80)}` });
    } finally { setPingLoading(false); }
  };

  if (!data) return <Loader />;

  return (
    <>
      <AdminHeader title="운영 모니터" subtitle="백엔드·DB·OpenClaw·이메일 상태" />

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder p="md" bg="dark.7">
            <Text fw={600} c="white" mb="sm">애플리케이션</Text>
            <Stack gap="xs">
              <Group justify="space-between"><Text size="sm" c="dimmed">이름</Text><Text size="sm">{data.app.name}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">환경</Text><Badge>{data.app.env}</Badge></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">현재시각</Text><Text size="sm">{data.now}</Text></Group>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder p="md" bg="dark.7">
            <Text fw={600} c="white" mb="sm">Database</Text>
            <Stack gap="xs">
              <Group justify="space-between"><Text size="sm" c="dimmed">URL</Text><Text size="xs" ff="monospace">{data.db.url_prefix}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">유저 수</Text><Text size="sm">{data.db.user_count}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">레이턴시</Text><Badge color={data.db.latency_ms < 50 ? 'green' : 'yellow'}>{data.db.latency_ms}ms</Badge></Group>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder p="md" bg="dark.7">
            <Group justify="space-between" mb="sm">
              <Text fw={600} c="white">OpenClaw</Text>
              <Button size="xs" leftSection={<IconRefresh size={14} />} onClick={doPing} loading={pingLoading}>Ping</Button>
            </Group>
            <Stack gap="xs">
              <Group justify="space-between"><Text size="sm" c="dimmed">WS URL</Text><Text size="xs" ff="monospace">{data.openclaw.ws_url}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">Agent</Text><Code>{data.openclaw.agent_pet}</Code></Group>
              <Text size="xs" c="dimmed">모델</Text>
              {Object.entries(data.openclaw.models).map(([k, v]) => (
                <Text key={k} size="xs" ff="monospace" pl="sm">{k}: {v}</Text>
              ))}
              {pingResult && (
                <Code block mt="sm">{JSON.stringify(pingResult, null, 2)}</Code>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder p="md" bg="dark.7">
            <Text fw={600} c="white" mb="sm">이메일 / 업로드</Text>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">이메일 Provider</Text>
                <Badge color={data.email.provider_configured ? 'green' : 'gray'}>
                  {data.email.provider_configured ? 'Resend 구성됨' : '로그 전용'}
                </Badge>
              </Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">발신자</Text><Text size="xs">{data.email.from}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">Upload DIR</Text><Text size="xs" ff="monospace">{data.upload.dir}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">최대 크기</Text><Text size="sm">{data.upload.max_mb} MB</Text></Group>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </>
  );
}
