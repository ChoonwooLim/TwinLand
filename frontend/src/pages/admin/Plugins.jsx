import { useEffect, useState } from 'react';
import { Accordion, Badge, Group, Loader, Paper, Text } from '@mantine/core';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';

export default function AdminPlugins() {
  const [items, setItems] = useState([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/admin/plugins').then((r) => {
      setItems(r.data.items);
      setSource(r.data.source);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <AdminHeader title="MCP 플러그인" subtitle={`${items.length}개 · 소스: ${source}`} />

      <Paper withBorder p="md" radius="md" bg="dark.7">
        {loading ? <Loader /> : (
          <Accordion variant="separated">
            {items.map((p, i) => (
              <Accordion.Item key={`${p.name}-${i}`} value={`${p.name}-${i}`}>
                <Accordion.Control>
                  <Group justify="space-between">
                    <Text fw={500}>{p.name}</Text>
                    {p.status && <Badge color="green" variant="light">{p.status}</Badge>}
                    {p.source && <Badge variant="outline">{p.source}</Badge>}
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  {p.desc && <Text size="sm" c="dimmed">{p.desc}</Text>}
                  {p.command && (
                    <Text size="xs" c="dimmed" mt={8} ff="monospace">
                      {p.command} {Array.isArray(p.args) ? p.args.join(' ') : ''}
                    </Text>
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </Paper>
    </>
  );
}
