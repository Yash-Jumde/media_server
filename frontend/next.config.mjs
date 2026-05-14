/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.0.3', '192.168.0.2', '127.0.0.1', 'localhost'],
  // No rewrites needed as we now talk directly to the backend on port 5000
  // This avoids dev-mode proxy timeouts for media streaming.
}

export default nextConfig;
