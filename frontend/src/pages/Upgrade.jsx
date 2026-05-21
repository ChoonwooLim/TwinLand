import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Badge, Button, Container, Paper, Stack, TextInput, Textarea, Title, Text, Table, Group,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { api } from '../lib/api.js';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { formatDateTime } from '../lib/format.js';

const STATUS_COLOR = { pending: 'blue', approved: 'green', rejected: 'red' };
const STATUS_LABEL = { pending: '대기중', approved: '승인됨', rejected: '반려' };

export default function Upgrade() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: { realname: '', phone: '', company: '', purpose: '' },
    validate: {
      realname: (v) => (v.trim() ? null : '필수'),
      phone: (v) => (v.trim() ? null : '필수'),
      purpose: (v) => (v.trim().length >= 10 ? null : '10자 이상'),
    },
  });

  const loadMine = async () => {
    try {
      const r = await api.get('/api/upgrade/mine');
      setMine(r.data.items);
    } catch {}
  };

  useEffect(() => { loadMine(); }, []);

  const alreadyEligible = user && (user.role === 'investor' || user.role === 'admin' || user.role === 'superadmin');
  const hasPending = mine.some((m) => m.status === 'pending');

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/api/upgrade/request', values);
      notifications.show({ title: '요청 접수', message: '관리자 검토 후 이메일로 안내드립니다', color: 'teal' });
      form.reset();
      loadMine();
    } catch (e) {
      notifications.show({ title: '실패', message: e?.response?.data?.detail || '오류', color: 'red' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size={720} py={60}>
      <Title order={2} c="white">투자자 등업 신청</Title>
      <Text c="dimmed" mt={6} size="sm">
        DataRoom 자료(피치덱, 재무 문서 등) 열람을 위해서는 투자자 등업이 필요합니다. 관리자 검토 후 승인됩니다.
      </Text>

      {alreadyEligible && (
        <Alert color="green" icon={<IconCheck size={16} />} mt={24} variant="light">
          이미 {user.role} 권한을 보유하고 계십니다.
          <Button ml={16} size="xs" variant="subtle" onClick={() => navigate('/dataroom')}>DataRoom 바로가기</Button>
        </Alert>
      )}

      {!alreadyEligible && hasPending && (
        <Alert color="blue" icon={<IconAlertCircle size={16} />} mt={24} variant="light">
          이미 심사 대기중인 요청이 있습니다. 중복 신청은 불가합니다.
        </Alert>
      )}

      {!alreadyEligible && !hasPending && (
        <Paper withBorder p={24} mt={24} radius="md" bg="dark.7">
          <form onSubmit={form.onSubmit(onSubmit)}>
            <Stack>
              <TextInput label="실명" required {...form.getInputProps('realname')} />
              <TextInput label="전화번호" placeholder="010-0000-0000" required {...form.getInputProps('phone')} />
              <TextInput label="소속 / 회사 (선택)" {...form.getInputProps('company')} />
              <Textarea label="투자 의사 및 목적" minRows={4} required {...form.getInputProps('purpose')} />
              <Button type="submit" loading={submitting}>등업 신청</Button>
            </Stack>
          </form>
        </Paper>
      )}

      {mine.length > 0 && (
        <>
          <Title order={4} mt={48} c="white">요청 이력</Title>
          <Paper withBorder p={16} mt={12} radius="md" bg="dark.7">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>신청일</Table.Th>
                  <Table.Th>상태</Table.Th>
                  <Table.Th>검토일</Table.Th>
                  <Table.Th>사유</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {mine.map((m) => (
                  <Table.Tr key={m.id}>
                    <Table.Td>{formatDateTime(m.created_at)}</Table.Td>
                    <Table.Td><Badge color={STATUS_COLOR[m.status]}>{STATUS_LABEL[m.status]}</Badge></Table.Td>
                    <Table.Td>{formatDateTime(m.reviewed_at)}</Table.Td>
                    <Table.Td>{m.reject_reason || '-'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </>
      )}

      <Group justify="center" mt={32}>
        <Button variant="subtle" onClick={() => navigate('/')}>홈으로</Button>
      </Group>
    </Container>
  );
}
