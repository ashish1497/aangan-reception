import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import ReadyMarker from '../components/ReadyMarker';
import './globals.css';

export const metadata = {
  title: 'Aangan Voice Desk',
  description:
    'Every Aangan Studio enquiry call answered in minutes, scored against the studio criteria and handed to a designer with a call already booked.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fafaf7',
};

const theme = {
  token: {
    colorPrimary: '#1d4ed8',
    colorLink: '#111111',
    colorLinkHover: '#1d4ed8',
    colorText: '#111111',
    colorTextSecondary: '#4d4d48',
    colorTextTertiary: '#4d4d48',
    colorTextDescription: '#4d4d48',
    colorTextHeading: '#111111',
    colorBgLayout: '#fafaf7',
    colorBorderSecondary: '#cfcfc8',
    colorError: '#d7261e',
    colorWarning: '#f2c230',
    colorInfo: '#1d4ed8',
    borderRadius: 2,
    borderRadiusSM: 2,
    borderRadiusLG: 2,
    boxShadow: 'none',
    boxShadowSecondary: 'none',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, system-ui, -apple-system, sans-serif",
  },
  components: {
    Table: { headerColor: '#111111', headerBg: 'transparent', rowHoverBg: '#ffffff', borderColor: '#cfcfc8' },
    Switch: { colorPrimary: '#111111', colorPrimaryHover: '#1d4ed8' },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <AntdRegistry>
          <ConfigProvider theme={theme}>{children}</ConfigProvider>
        </AntdRegistry>
        <ReadyMarker />
      </body>
    </html>
  );
}
