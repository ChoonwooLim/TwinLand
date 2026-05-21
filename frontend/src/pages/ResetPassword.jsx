import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Button, Container, Paper, PasswordInput, Stack, Title, Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { api } from '../lib/api.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: { password: '', passwordConfirm: '' },
    validate: {
      password: (v) => (v.length >= 8 ? null : '8자 이상'),
      passwordConfirm: (v, vals) => (v === vals.password ? null : '일치하지 않음'),
    },
  });

  const onSubmit = async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/auth/reset-password', { token, new_password: values.password });
      navigate('/login', { replace: true });
    } catch (e) {
      setError(e?.response?.data?.detail || '재설정 실패 — 링크가 만료되었을 수 있습니다');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <Container size={440} py={80}>
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          유효하지 않은 링크입니다.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size={440} py={80}>
      <Title order={2} ta="center" c="white">비밀번호 재설정</Title>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md" bg="dark.7">
        <form onSubmit={form.onSubmit(onSubmit)}>
          <Stack>
            {error && <Alert color="red">{error}</Alert>}
            <PasswordInput label="새 비밀번호" required {...form.getInputProps('password')} />
            <PasswordInput label="새 비밀번호 확인" required {...form.getInputProps('passwordConfirm')} />
            <Button type="submit" loading={submitting} fullWidth>변경</Button>
            <Text component={Link} to="/login" size="xs" ta="center" c="dimmed">로그인으로</Text>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
