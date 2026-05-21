import { Box, Group, Stack, Text, Title } from '@mantine/core';

export default function AdminHeader({ title, subtitle, action }) {
  return (
    <Box mb={24}>
      <Group justify="space-between" align="flex-end">
        <Stack gap={4}>
          <Title order={2} c="white">{title}</Title>
          {subtitle && <Text c="dimmed" size="sm">{subtitle}</Text>}
        </Stack>
        {action}
      </Group>
    </Box>
  );
}
