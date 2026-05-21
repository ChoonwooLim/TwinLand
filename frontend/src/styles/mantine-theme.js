import { createTheme } from '@mantine/core';

// JooJooLand 다크 팔레트 — Aurora 계열을 primary 로
const joojoo = [
  '#eae7ff', '#cfc7ff', '#aea3ff', '#8e80ff', '#7563ff',
  '#6b5bff', '#5a48ff', '#4836e6', '#3827b8', '#2c1f91',
];

export const mantineTheme = createTheme({
  primaryColor: 'joojoo',
  colors: {
    joojoo,
  },
  fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  headings: {
    fontFamily: "Pretendard, sans-serif",
    fontWeight: '600',
  },
  defaultRadius: 'md',
  cursorType: 'pointer',
  autoContrast: true,
});
