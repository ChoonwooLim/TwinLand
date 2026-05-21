import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Paper, Stack, TextInput, Textarea, Button, Alert, Box, Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCheck } from '@tabler/icons-react';
import AuroraBackground from '../components/hero/AuroraBackground.jsx';
import SectionTitle from '../components/common/SectionTitle.jsx';
import CTAButton from '../components/common/CTAButton.jsx';
import { api } from '../lib/api.js';
import styles from './Contact.module.css';

export default function Contact() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const form = useForm({
    initialValues: { email: '', name: '', company: '', phone: '', message: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : '올바른 이메일'),
      message: (v) => (v.trim().length >= 5 ? null : '5자 이상'),
    },
  });

  const onSubmit = async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/leads', {
        email: values.email,
        name: values.name || null,
        company: values.company || null,
        phone: values.phone || null,
        message: values.message,
        source: 'contact_form',
      });
      setSubmitted(true);
      form.reset();
    } catch (e) {
      setError(e?.response?.data?.detail || '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.wrap}>
      <AuroraBackground intensity={0.5} />
      <div className={styles.inner}>
        <SectionTitle
          eyebrow="Contact"
          title={t('contact.title')}
          subtitle={t('contact.subtitle')}
          align="center"
          invert
        />

        <div className={styles.card}>
          <div className={styles.cardLabel}>Founder · IP Holder · All Inquiries</div>
          <h3 className={styles.name}>Steven Lim</h3>
          <div className={styles.credentials}>
            All licenses, trademarks, and intellectual property rights of
            <br /> <strong>Pet Twinverse · JooJooLand</strong> are held by Steven Lim.
          </div>
          <div className={styles.contactGrid}>
            <ContactRow
              label={t('contact.investorEmail') + ' / ' + t('contact.partnerEmail')}
              value="choonwoo49@gmail.com"
              href="mailto:choonwoo49@gmail.com"
            />
            <ContactRow label="Phone" value="+82 10-4173-6570" href="tel:+821041736570" />
            <ContactRow label="Location" value="Republic of Korea" />
          </div>

          <div className={styles.ctas}>
            <CTAButton
              href="mailto:choonwoo49@gmail.com?subject=Pet Twinverse Investor Inquiry"
              variant="primary"
              size="lg"
            >
              {t('cta.secondary')} ✉︎
            </CTAButton>
            <CTAButton
              href="mailto:choonwoo49@gmail.com?subject=Pet Twinverse Waitlist"
              variant="secondary"
              size="lg"
            >
              {t('cta.signup')}
            </CTAButton>
          </div>
        </div>

        <Box maw={640} mx="auto" mt={48}>
          <Paper withBorder p={28} radius="md" bg="rgba(16, 26, 56, 0.85)">
            <Text size="lg" fw={600} c="white" mb={6}>온라인 문의</Text>
            <Text size="sm" c="dimmed" mb={20}>
              관심사를 남겨주시면 담당자가 곧 연락드립니다.
            </Text>

            {submitted ? (
              <Alert color="teal" icon={<IconCheck size={16} />} variant="light">
                문의가 접수되었습니다. 곧 연락드리겠습니다.
              </Alert>
            ) : (
              <form onSubmit={form.onSubmit(onSubmit)}>
                <Stack>
                  {error && <Alert color="red">{error}</Alert>}
                  <TextInput label="이메일" required {...form.getInputProps('email')} />
                  <TextInput label="이름" {...form.getInputProps('name')} />
                  <TextInput label="회사 / 소속" {...form.getInputProps('company')} />
                  <TextInput label="연락처" {...form.getInputProps('phone')} />
                  <Textarea label="메시지" required minRows={4} {...form.getInputProps('message')} />
                  <Button type="submit" loading={submitting} size="md">문의 보내기</Button>
                </Stack>
              </form>
            )}
          </Paper>
        </Box>
      </div>
    </section>
  );
}

function ContactRow({ label, value, href }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>{label}</div>
      <div className={styles.rowValue}>
        {href ? <a href={href}>{value}</a> : value}
      </div>
    </div>
  );
}
