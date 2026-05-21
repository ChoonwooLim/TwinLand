import { useEffect, useState } from 'react';
import {
  Badge, Button, FileInput, Group, Loader, Modal, Paper, Select, Stack, Table, Text, TextInput, Textarea, Drawer, Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconUpload, IconTrash, IconEye, IconHistory } from '@tabler/icons-react';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';
import { formatBytes, formatDateTime } from '../../lib/format.js';

const ACCESS_LEVELS = [
  { value: 'public', label: '공개' },
  { value: 'investor', label: '투자자' },
  { value: 'admin', label: '관리자' },
];

export default function AdminDataRoom() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [accessLevel, setAccessLevel] = useState('investor');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const [logsDoc, setLogsDoc] = useState(null);
  const [logs, setLogs] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/dataroom');
      setItems(r.data.items);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const onUpload = async () => {
    if (!file || !title.trim()) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    fd.append('access_level', accessLevel);
    if (description) fd.append('description', description);

    setUploading(true);
    try {
      await api.post('/api/dataroom/admin/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notifications.show({ color: 'teal', message: '업로드 완료' });
      setUploadOpen(false);
      setFile(null); setTitle(''); setDescription(''); setAccessLevel('investor');
      load();
    } catch (e) {
      notifications.show({ color: 'red', message: e?.response?.data?.detail || '업로드 실패' });
    } finally { setUploading(false); }
  };

  const changeAccess = async (doc, newLevel) => {
    try {
      await api.put(`/api/dataroom/admin/${doc.id}`, { access_level: newLevel });
      load();
    } catch (e) {
      notifications.show({ color: 'red', message: e?.response?.data?.detail || '실패' });
    }
  };

  const remove = (doc) => {
    modals.openConfirmModal({
      title: '문서 삭제',
      children: <Text size="sm">{doc.title} 을 삭제합니다. 파일도 함께 삭제됩니다.</Text>,
      labels: { confirm: '삭제', cancel: '취소' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await api.delete(`/api/dataroom/admin/${doc.id}`);
        load();
      },
    });
  };

  const openLogs = async (doc) => {
    setLogsDoc(doc);
    try {
      const r = await api.get('/api/dataroom/admin/downloads', { params: { doc_id: doc.id } });
      setLogs(r.data.items);
    } catch {}
  };

  return (
    <>
      <AdminHeader
        title="DataRoom 문서"
        subtitle={`총 ${items.length}건 · 업로드 시 access_level 을 지정하세요`}
        action={
          <Button leftSection={<IconUpload size={16} />} onClick={() => setUploadOpen(true)}>업로드</Button>
        }
      />

      <Paper withBorder p="md" radius="md" bg="dark.7">
        {loading ? <Loader /> : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>제목</Table.Th>
                <Table.Th>타입</Table.Th>
                <Table.Th>크기</Table.Th>
                <Table.Th>Access</Table.Th>
                <Table.Th>버전</Table.Th>
                <Table.Th>업데이트</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((d) => (
                <Table.Tr key={d.id}>
                  <Table.Td><Text fw={500}>{d.title}</Text>{d.description && <Text size="xs" c="dimmed">{d.description}</Text>}</Table.Td>
                  <Table.Td><Badge variant="light">{d.file_type}</Badge></Table.Td>
                  <Table.Td>{formatBytes(d.size_bytes)}</Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      data={ACCESS_LEVELS}
                      value={d.access_level}
                      onChange={(v) => v && v !== d.access_level && changeAccess(d, v)}
                      w={110}
                    />
                  </Table.Td>
                  <Table.Td>v{d.version}</Table.Td>
                  <Table.Td>{formatDateTime(d.updated_at)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" variant="light" leftSection={<IconEye size={14} />} component="a" href={`/api/dataroom/${d.id}/download`} target="_blank">열기</Button>
                      <Button size="xs" variant="subtle" leftSection={<IconHistory size={14} />} onClick={() => openLogs(d)}>로그</Button>
                      <Button size="xs" color="red" variant="light" leftSection={<IconTrash size={14} />} onClick={() => remove(d)}>삭제</Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {items.length === 0 && <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center">문서 없음</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal opened={uploadOpen} onClose={() => setUploadOpen(false)} title="문서 업로드" size="lg">
        <Stack>
          <FileInput label="파일" placeholder="PDF/XLSX/ZIP 등" value={file} onChange={setFile} required />
          <TextInput label="제목" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
          <Select label="공개 범위" data={ACCESS_LEVELS} value={accessLevel} onChange={(v) => v && setAccessLevel(v)} />
          <Textarea label="설명 (선택)" value={description} onChange={(e) => setDescription(e.currentTarget.value)} minRows={3} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setUploadOpen(false)}>취소</Button>
            <Button onClick={onUpload} loading={uploading} disabled={!file || !title.trim()}>업로드</Button>
          </Group>
        </Stack>
      </Modal>

      <Drawer opened={!!logsDoc} onClose={() => setLogsDoc(null)} title={logsDoc && `${logsDoc.title} — 다운로드 로그`} position="right" size="md">
        {logsDoc && (
          <Stack>
            <Text size="xs" c="dimmed">최근 500건</Text>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>시각</Table.Th>
                  <Table.Th>사용자 ID</Table.Th>
                  <Table.Th>IP</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {logs.map((l) => (
                  <Table.Tr key={l.id}>
                    <Table.Td>{formatDateTime(l.created_at)}</Table.Td>
                    <Table.Td>{l.user_id}</Table.Td>
                    <Table.Td>{l.ip || '-'}</Table.Td>
                  </Table.Tr>
                ))}
                {logs.length === 0 && <Table.Tr><Table.Td colSpan={3}><Text c="dimmed" ta="center">로그 없음</Text></Table.Td></Table.Tr>}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
      </Drawer>
    </>
  );
}
