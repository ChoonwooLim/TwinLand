import { useEffect, useState } from 'react';
import { Badge, Loader, Paper, Table, Tabs, Text } from '@mantine/core';
import AdminHeader from '../../features/admin/AdminHeader.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

export default function AdminClones() {
  const [pets, setPets] = useState([]);
  const [clones, setClones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pets');

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/admin/clones');
        setPets(r.data.pets);
        setClones(r.data.clones);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <>
      <AdminHeader title="Pet / Clone" subtitle="반려동물 프로필 + 디지털 클론 버전" />

      <Tabs value={tab} onChange={setTab} mb="md">
        <Tabs.List>
          <Tabs.Tab value="pets">반려동물 ({pets.length})</Tabs.Tab>
          <Tabs.Tab value="clones">클론 ({clones.length})</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Paper withBorder p="md" radius="md" bg="dark.7">
        {loading ? <Loader /> : tab === 'pets' ? (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>이름</Table.Th>
                <Table.Th>종</Table.Th>
                <Table.Th>품종</Table.Th>
                <Table.Th>소유자</Table.Th>
                <Table.Th>추모</Table.Th>
                <Table.Th>클론</Table.Th>
                <Table.Th>등록일</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pets.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.name}</Table.Td>
                  <Table.Td>{p.species}</Table.Td>
                  <Table.Td>{p.breed || '-'}</Table.Td>
                  <Table.Td><Text size="sm">{p.owner_email || '-'}</Text></Table.Td>
                  <Table.Td>{p.is_memorial ? <Badge color="gray">추모</Badge> : '-'}</Table.Td>
                  <Table.Td>{p.has_clone ? <Badge color="violet">O</Badge> : '-'}</Table.Td>
                  <Table.Td>{formatDateTime(p.created_at)}</Table.Td>
                </Table.Tr>
              ))}
              {pets.length === 0 && <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center">없음</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>펫 이름</Table.Th>
                <Table.Th>종</Table.Th>
                <Table.Th>소유자</Table.Th>
                <Table.Th>버전</Table.Th>
                <Table.Th>모델</Table.Th>
                <Table.Th>생성일</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {clones.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td>{c.pet_name || '-'}</Table.Td>
                  <Table.Td>{c.pet_species || '-'}</Table.Td>
                  <Table.Td><Text size="sm">{c.owner_email || '-'}</Text></Table.Td>
                  <Table.Td>v{c.version}</Table.Td>
                  <Table.Td><Text size="xs" ff="monospace">{c.model_ref || '-'}</Text></Table.Td>
                  <Table.Td>{formatDateTime(c.created_at)}</Table.Td>
                </Table.Tr>
              ))}
              {clones.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" ta="center">없음</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </>
  );
}
