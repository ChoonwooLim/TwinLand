import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/charts/styles.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';

import { mantineTheme } from './styles/mantine-theme.js';
import { AuthProvider } from './features/auth/AuthContext.jsx';
import { registerSW } from './lib/sw-register.js';
import UpdateBanner from './components/UpdateBanner.jsx';
import './i18n';
import './styles/tokens.css';
import './styles/global.css';
import './styles/animations.css';
import App from './App.jsx';

// Service Worker 등록 — 새 빌드 감지 시 'twinland:sw-update' 이벤트 발행 → UpdateBanner 가 처리
registerSW({
  onUpdate: () => {
    // 토스트 컴포넌트가 듣고 카운트다운 시작
    window.dispatchEvent(new CustomEvent('twinland:sw-update'));
  },
  // SW 자체의 자동 reload 는 끄고 (UpdateBanner 가 3초 카운트다운 후 reload 담당)
  autoReloadDelayMs: 0,
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MantineProvider theme={mantineTheme} defaultColorScheme="dark">
      <ModalsProvider>
        <Notifications position="top-right" zIndex={2000} />
        <BrowserRouter>
          <AuthProvider>
            <UpdateBanner />
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
);
