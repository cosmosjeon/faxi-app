// Tailwind CSS 설정 타입을 가져옵니다
import type { Config } from 'tailwindcss';

// Tailwind CSS 설정 객체
const config = {
  // 다크모드 설정 - class 기반으로 다크모드 전환
  darkMode: ['class'],
  
  // CSS를 추출할 파일 경로 설정
  content: ['./src/**/*.{ts,tsx}'], // src 폴더의 모든 TypeScript/React 파일
  
  // CSS 접두사 설정 (기본값: 빈 문자열)
  prefix: '',
  
  // 테마 설정
  theme: {
    // 컨테이너 설정
    container: {
      center: true, // 중앙 정렬
      padding: '2rem', // 좌우 패딩
      screens: {
        '2xl': '1400px', // 2xl 브레이크포인트
      },
    },
    
    // 테마 확장 설정
    extend: {
      // 색상 팔레트 정의 (CSS 변수 사용)
      colors: {
        border: 'hsl(var(--border))', // 테두리 색상
        input: 'hsl(var(--input))', // 입력 필드 색상
        ring: 'hsl(var(--ring))', // 포커스 링 색상
        background: 'hsl(var(--background))', // 배경 색상
        foreground: 'hsl(var(--foreground))', // 전경 색상 (텍스트)
        primary: {
          DEFAULT: 'hsl(var(--primary))', // 기본 primary 색상
          foreground: 'hsl(var(--primary-foreground))', // primary 위의 텍스트 색상
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))', // 기본 secondary 색상
          foreground: 'hsl(var(--secondary-foreground))', // secondary 위의 텍스트 색상
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))', // 삭제/오류 색상
          foreground: 'hsl(var(--destructive-foreground))', // destructive 위의 텍스트 색상
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))', // 음소거된 색상
          foreground: 'hsl(var(--muted-foreground))', // muted 위의 텍스트 색상
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))', // 강조 색상
          foreground: 'hsl(var(--accent-foreground))', // accent 위의 텍스트 색상
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))', // 팝오버 배경 색상
          foreground: 'hsl(var(--popover-foreground))', // 팝오버 텍스트 색상
        },
        card: {
          DEFAULT: 'hsl(var(--card))', // 카드 배경 색상
          foreground: 'hsl(var(--card-foreground))', // 카드 텍스트 색상
        },
      },
      
      // 테두리 반경 설정
      borderRadius: {
        lg: 'var(--radius)', // 큰 테두리 반경
        md: 'calc(var(--radius) - 2px)', // 중간 테두리 반경
        sm: 'calc(var(--radius) - 4px)', // 작은 테두리 반경
      },
      
      // 키프레임 애니메이션 정의
      keyframes: {
        'accordion-down': {
          from: { height: '0' }, // 시작: 높이 0
          to: { height: 'var(--radix-accordion-content-height)' }, // 끝: Radix UI 아코디언 높이
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' }, // 시작: Radix UI 아코디언 높이
          to: { height: '0' }, // 끝: 높이 0
        },
      },
      
      // 애니메이션 설정
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out', // 아코디언 펼치기 애니메이션
        'accordion-up': 'accordion-up 0.2s ease-out', // 아코디언 접기 애니메이션
      },
    },
  },
  
  // 플러그인 설정
  plugins: [
    require('tailwindcss-animate'), // 애니메이션 플러그인
    require('@tailwindcss/typography'), // 타이포그래피 플러그인
  ],
} satisfies Config;

// 설정 객체를 내보냅니다
export default config;
