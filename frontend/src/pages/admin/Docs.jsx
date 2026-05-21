import { useEffect, useState } from 'react';
import { Box, Grid, Loader, Paper, ScrollArea, Text, UnstyledButton } from '@mantine/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

export default function AdminDocs() {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/admin/docs').then((r) => {
      setItems(r.data.items);
      if (r.data.items[0]) load(r.data.items[0].path);
    }).finally(() => setLoading(false));
  }, []);

  const load = async (path) => {
    setActive(path);
    try {
      const r = await api.get('/api/admin/docs/content', { params: { path } });
      setContent(r.data.content);
    } catch (e) {
      setContent(`# 로드 실패\n\n${e?.response?.data?.detail || e.message}`);
    }
  };

  return (
    <>
      <AdminHeader title="프로젝트 문서" subtitle={`${items.length}개 MD 파일`} />

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p="sm" radius="md" bg="dark.7">
            <ScrollArea h={600}>
              {loading ? <Loader /> : items.map((f) => (
                <UnstyledButton
                  key={f.path}
                  onClick={() => load(f.path)}
                  style={{ display: 'block', padding: 8, borderRadius: 6, width: '100%', background: active === f.path ? 'var(--mantine-color-dark-5)' : 'transparent' }}
                >
                  <Text size="sm" fw={active === f.path ? 600 : 400}>{f.path}</Text>
                  <Text size="xs" c="dimmed">{(f.size / 1024).toFixed(1)} KB</Text>
                </UnstyledButton>
              ))}
            </ScrollArea>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper withBorder p="lg" radius="md" bg="dark.7" style={{ minHeight: 600 }}>
            {active ? (
              <Box className="markdown-body" style={{ color: '#eaeaf5' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </Box>
            ) : <Text c="dimmed">왼쪽에서 문서를 선택하세요</Text>}
          </Paper>
        </Grid.Col>
      </Grid>
    </>
  );
}
