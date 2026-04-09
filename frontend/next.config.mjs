/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'http://127.0.0.1:5000/api/:path*' // Proxy to Backend
        },
        {
          source: '/stream/:path*',
          destination: 'http://127.0.0.1:5000/stream/:path*' // Proxy streaming
        },
        {
          source: '/images/:path*',
          destination: 'http://127.0.0.1:5000/images/:path*' // Proxy thumbnails
        },
        {
          source: '/subtitles/:path*',
          destination: 'http://127.0.0.1:5000/subtitles/:path*' // Proxy subtitles
        },
        {
          source: '/thumbnails/:path*',
          destination: 'http://127.0.0.1:5000/thumbnails/:path*' // Proxy thumbnails
        },
        {
          source: '/covers/:path*',
          destination: 'http://127.0.0.1:5000/covers/:path*' // Proxy covers
        }
      ]
    }
  }
  
  export default nextConfig;
