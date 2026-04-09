import './globals.css';

export const metadata = {
  title: 'MediaVault - Personal Media Server',
  description: 'A premium personal media server for movies, TV shows, music, and more.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
