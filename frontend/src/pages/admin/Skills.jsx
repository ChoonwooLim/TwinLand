import { useEffect, useState } from 'react';
import { Accordion, Badge, Group, Loader, Paper, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';

export default function AdminSkills() {
  const [items, setItems] = useState([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get('/api/admin/skills').then((r) => {
      setItems(r.data.items);
      setSource(r.data.source);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = q ? items.filter((i) => (i.name + ' ' + (i.desc || '')).toLowerCase().includes(q.toLowerCase())) : items;

  return (
    <>
      <AdminHeader
        title="Claude Code 스킬"
        subtitle={`${items.length}개 · 소스: ${source}`}
      />

      <Paper withBorder p="md" radius="md" bg="dark.7" mb="md">
        <TextInput placeholder="스킬 검색" leftSection={<IconSearch size={16} />} value={q} onChange={(e) => setQ(e.currentTarget.value)} />
      </Paper>

      <Paper withBorder p="md" radius="md" bg="dark.7">
        {loading ? <Loader /> : (
          <Accordion variant="separated">
            {filtered.map((s, i) => (
              <Accordion.Item key={`${s.name}-${i}`} value={`${s.name}-${i}`}>
                <Accordion.Control>
                  <Group justify="space-between">
                    <Text fw={500}>{s.name}</Text>
                    <Badge variant="light">{s.plugin || 'user'}</Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm" c="dimmed">{s.desc || '(설명 없음)'}</Text>
                  {s.path && <Text size="xs" c="dimmed" mt={8} ff="monospace">{s.path}</Text>}
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </Paper>
    </>
  );
}
