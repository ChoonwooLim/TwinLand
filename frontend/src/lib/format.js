import dayjs from 'dayjs';

export function formatDateTime(iso) {
  if (!iso) return '-';
  return dayjs(iso).format('YYYY-MM-DD HH:mm');
}

export function formatDate(iso) {
  if (!iso) return '-';
  return dayjs(iso).format('YYYY-MM-DD');
}

export function formatBytes(n) {
  if (n == null) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function roleLabel(role) {
  const m = {
    superadmin: '슈퍼관리자',
    admin: '관리자',
    investor: '투자자',
    guest: '일반회원',
  };
  return m[role] || role;
}

export function stageLabel(stage) {
  const m = {
    new: '신규',
    contacting: '연락중',
    meeting: '미팅',
    diligence: '실사',
    contract: '계약',
    hold: '보류',
    closed: '종료',
  };
  return m[stage] || stage;
}

export function stageColor(stage) {
  return {
    new: 'blue',
    contacting: 'cyan',
    meeting: 'teal',
    diligence: 'yellow',
    contract: 'green',
    hold: 'orange',
    closed: 'gray',
  }[stage] || 'gray';
}
