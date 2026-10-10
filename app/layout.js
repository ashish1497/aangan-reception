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
  themeColor: '#f6f4ef',
};

const theme = {
  token: {
    colorPrimary: '#8a4b2a',
    colorLink: '#8a4b2a',
    colorText: '#1f2328',
    colorTextSecondary: '#4f555c',
    colorTextTertiary: '#4f555c',
    colorTextDescription: '#4f555c',
    colorTextHeading: '#1f2328',
    colorBgLayout: '#f6f4ef',
    colorBorderSecondary: '#e3dfd6',
    borderRadius: 8,
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Table: { headerColor: '#3d4247', headerBg: '#faf8f4', rowHoverBg: '#f6f4ef' },
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
