import { useEffect, useState } from 'react';
import {
  Accordion, Button, Group, Loader, Paper, Stack, Tabs, Text, Textarea, Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';

const PAGES = [
  { value: 'home', label: 'Home' },
  { value: 'investment', label: 'Investment' },
];

export default function AdminContent() {
  const [page, setPage] = useState('home');
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async (p) => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/content', { params: { page: p } });
      setBlocks(r.data.items);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(page); }, [page]);

  const update = (id, field, val) => {
    setBlocks((list) => list.map((b) => (b.id === id ? { ...b, [field]: val } : b)));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/api/admin/content/bulk', {
        blocks: blocks.map((b) => ({
          page: b.page,
          slot: b.slot,
          key: b.key,
          value_ko: b.value_ko,
          value_en: b.value_en,
          order_idx: b.order_idx,
        })),
      });
      notifications.show({ color: 'teal', message: '저장 완료' });
      load(page);
    } catch (e) {
      notifications.show({ color: 'red', message: e?.response?.data?.detail || '실패' });
    } finally { setSaving(false); }
  };

  const bySlot = blocks.reduce((acc, b) => {
    (acc[b.slot] = acc[b.slot] || []).push(b);
    return acc;
  }, {});

  return (
    <>
      <AdminHeader
        title="콘텐츠 CMS"
        subtitle="로드맵·팀·재무·통계 블록 편집 (ko/en)"
        action={<Button onClick={save} loading={saving}>전체 저장</Button>}
      />

      <Tabs value={page} onChange={(v) => v && setPage(v)} mb="md">
        <Tabs.List>
          {PAGES.map((p) => <Tabs.Tab key={p.value} value={p.value}>{p.label}</Tabs.Tab>)}
        </Tabs.List>
      </Tabs>

      {loading ? <Loader /> : (
        <Accordion multiple defaultValue={Object.keys(bySlot)} variant="separated">
          {Object.entries(bySlot).map(([slot, items]) => (
            <Accordion.Item key={slot} value={slot}>
              <Accordion.Control>
                <Text fw={600}>{slot}</Text>
                <Text size="xs" c="dimmed">{items.length} 블록</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack>
                  {items.sort((a, b) => a.order_idx - b.order_idx).map((b) => (
                    <Paper withBorder p="sm" radius="md" bg="dark.6" key={b.id}>
                      <Text size="xs" c="dimmed" mb={4}>{b.key}</Text>
                      <Group grow align="flex-start">
                        <Textarea label="한국어" value={b.value_ko} onChange={(e) => update(b.id, 'value_ko', e.currentTarget.value)} autosize minRows={1} maxRows={4} />
                        <Textarea label="English" value={b.value_en} onChange={(e) => update(b.id, 'value_en', e.currentTarget.value)} autosize minRows={1} maxRows={4} />
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </>
  );
}
