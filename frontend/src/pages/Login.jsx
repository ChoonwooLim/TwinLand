import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Anchor, Button, Container, Divider, Paper, PasswordInput, Stack,
  TextInput, Title, Text, Alert, Box,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../features/auth/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : '올바른 이메일 형식이 아닙니다'),
      password: (v) => (v.length >= 8 ? null : '비밀번호는 8자 이상입니다'),
    },
  });

  const onSubmit = async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(values.email, values.password);
      const from = location.state?.from;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
      } else if (user.role === 'admin' || user.role === 'superadmin') {
        navigate('/admin', { replace: true });
      } else if (user.role === 'investor') {
        navigate('/dataroom', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (e) {
      setError(e?.response?.data?.detail || '로그인에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size={440} py={80}>
      <Title order={2} ta="center" c="white">JooJooLand 로그인</Title>
      <Text ta="center" c="dimmed" size="sm" mt={6}>
        계정이 없으신가요?{' '}
        <Anchor component={Link} to="/register" c="violet.3">회원가입</Anchor>
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md" bg="dark.7">
        <form onSubmit={form.onSubmit(onSubmit)}>
          <Stack>
            {error && (
              <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
                {error}
              </Alert>
            )}
            <TextInput
              label="이메일"
              placeholder="you@example.com"
              {...form.getInputProps('email')}
              autoComplete="email"
              required
            />
            <PasswordInput
              label="비밀번호"
              placeholder="8자 이상"
              {...form.getInputProps('password')}
              autoComplete="current-password"
              required
            />
            <Box ta="right">
              <Anchor component={Link} to="/forgot-password" size="xs" c="dimmed">
                비밀번호를 잊으셨나요?
              </Anchor>
            </Box>
            <Button type="submit" loading={submitting} fullWidth>
              로그인
            </Button>
          </Stack>
        </form>
        <Divider my="md" label="또는" labelPosition="center" />
        <Button component={Link} to="/" variant="subtle" fullWidth>
          홈으로
        </Button>
      </Paper>
    </Container>
  );
}
