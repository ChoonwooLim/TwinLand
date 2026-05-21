import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert, Anchor, Button, Container, Paper, PasswordInput, Stack,
  TextInput, Title, Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../features/auth/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: { email: '', password: '', passwordConfirm: '', display_name: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : '올바른 이메일 형식이 아닙니다'),
      password: (v) => (v.length >= 8 ? null : '비밀번호는 8자 이상'),
      passwordConfirm: (v, vals) => (v === vals.password ? null : '비밀번호가 일치하지 않습니다'),
    },
  });

  const onSubmit = async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await register({
        email: values.email,
        password: values.password,
        display_name: values.display_name || undefined,
      });
      navigate('/', { replace: true });
    } catch (e) {
      setError(e?.response?.data?.detail || '회원가입에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size={440} py={80}>
      <Title order={2} ta="center" c="white">회원가입</Title>
      <Text ta="center" c="dimmed" size="sm" mt={6}>
        이미 계정이 있으신가요?{' '}
        <Anchor component={Link} to="/login" c="violet.3">로그인</Anchor>
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md" bg="dark.7">
        <form onSubmit={form.onSubmit(onSubmit)}>
          <Stack>
            {error && (
              <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
                {error}
              </Alert>
            )}
            <TextInput label="이메일" placeholder="you@example.com" required {...form.getInputProps('email')} />
            <TextInput label="표시 이름 (선택)" placeholder="홍길동" {...form.getInputProps('display_name')} />
            <PasswordInput label="비밀번호" required {...form.getInputProps('password')} />
            <PasswordInput label="비밀번호 확인" required {...form.getInputProps('passwordConfirm')} />
            <Text size="xs" c="dimmed">
              가입 후 투자자 DataRoom 접근이 필요하시면 로그인 후 투자자 등업을 신청해 주세요.
            </Text>
            <Button type="submit" loading={submitting} fullWidth>가입하기</Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
