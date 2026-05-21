import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert, Anchor, Button, Container, Paper, Stack, TextInput, Title, Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCheck } from '@tabler/icons-react';
import { api } from '../lib/api.js';

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: { email: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : '이메일 형식'),
    },
  });

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/api/auth/forgot-password', { email: values.email });
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size={440} py={80}>
      <Title order={2} ta="center" c="white">비밀번호 찾기</Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md" bg="dark.7">
        {sent ? (
          <Stack>
            <Alert color="green" icon={<IconCheck size={16} />} variant="light">
              해당 이메일로 재설정 링크를 전송했습니다. 받은편지함을 확인해 주세요.
            </Alert>
            <Button component={Link} to="/login" fullWidth>로그인으로</Button>
          </Stack>
        ) : (
          <form onSubmit={form.onSubmit(onSubmit)}>
            <Stack>
              <Text size="sm" c="dimmed">가입 시 사용한 이메일을 입력하면 재설정 링크를 보내드립니다.</Text>
              <TextInput label="이메일" required {...form.getInputProps('email')} />
              <Button type="submit" loading={submitting} fullWidth>재설정 링크 받기</Button>
              <Anchor component={Link} to="/login" size="xs" ta="center" c="dimmed">로그인으로 돌아가기</Anchor>
            </Stack>
          </form>
        )}
      </Paper>
    </Container>
  );
}
