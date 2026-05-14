These are the errors I get:
On the terminal:
[1] [browser] [Player] Video element error event: [object Object] 
[1] [browser] [Player] Video Error: {
[1]   code: 3,
[1]   message: 'Media failed to decode',
[1]   networkState: 1,
[1]   readyState: 1,
[1]   src: 'http://192.168.0.2:5000/hls/301/playlist.m3u8?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImF2YXRhcl91cmwiOm51bGwsImlhdCI6MTc3ODAxMDU5NywiZXhwIjoxNzc4MDk2OTk3fQ.7giJLnIWrAgcmJ6Dxyo6lD4vvtv3g519IM5u2nIgPN4&t=1778010622016'
[1] }
[1]
[0] GET /api/stream-mode/301 304 4.175 ms - -
[0] GET /hls/301/playlist.m3u8?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImF2YXRhcl91cmwiOm51bGwsImlhdCI6MTc3ODAxMDU5NywiZXhwIjoxNzc4MDk2OTk3fQ.7giJLnIWrAgcmJ6Dxyo6lD4vvtv3g519IM5u2nIgPN4&t=1778010627027 200 6.454 ms - 272       
[0] GET /hls/301/playlist.m3u8?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImF2YXRhcl91cmwiOm51bGwsImlhdCI6MTc3ODAxMDU5NywiZXhwIjoxNzc4MDk2OTk3fQ.7giJLnIWrAgcmJ6Dxyo6lD4vvtv3g519IM5u2nIgPN4&t=1778010627027 200 2.542 ms - 272       
[0] GET /hls/301/segment003.ts 401 0.313 ms - 33
[1] [browser] [Player] Video element error event: [object Object] 
[1] [browser] [Player] Video Error: {
[1]   code: 3,
[1]   message: 'Media failed to decode',
[1]   networkState: 1,
[1]   readyState: 1,
[1]   src: 'http://192.168.0.2:5000/hls/301/playlist.m3u8?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImF2YXRhcl91cmwiOm51bGwsImlhdCI6MTc3ODAxMDU5NywiZXhwIjoxNzc4MDk2OTk3fQ.7giJLnIWrAgcmJ6Dxyo6lD4vvtv3g519IM5u2nIgPN4&t=1778010627027'
[1] }

and on the browser on the ipad:
[1:21 am, 6/5/2026] Yash Jumadey: Console Error



[Player] Video element error event: {}
components/Player/VideoElement.js (107:24) @ onError

  105 |         // Ignore errors if hls.js is handling it
  106 |         if (!shouldUseHlsJs) {
> 107 |           console.error('[Player] Video element error event:', e);
      |                        ^
  108 |         }
  109 |       }}
  110 |       onPlay={onPlay}
Call Stack
14
Show 10 ignore-listed frame(s)
onError
components/Player/VideoElement.js (107:24)
video
unknown (0:0)
Player
components/Player.js (447:15)
WatchPage
app/watch/[id]/page.js (64:7)
[1:21 am, 6/5/2026] Yash Jumadey: Console Error



[Player] Video Error: {}
components/Player.js (161:20) @ Player.useEffect.handleError

  159 |     const handleError = (e) => {
  160 |       const error = video.error;
> 161 |       console.error('[Player] Video Error:', {
      |                    ^
  162 |         code: error?.code,
  163 |         message: error?.message,
  164 |         src: video.currentSrc || video.src,
Call Stack
4
Show 3 ignore-listed frame(s)
Player.useEffect.handleError
components/Player.js (161:20)
[1:21 am, 6/5/2026] Yash Jumadey: Console Error


A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:
- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

See more info here: https://nextjs.org/docs/messages/react-hydration-error


+
Client
-
Server
  ...
    <HotReload globalError={[...]} webSocket={WebSocket} staticIndicatorState={{pathname:null, ...}}>
      <AppDevOverlayErrorBoundary globalError={[...]}>
        <ReplaySsrOnlyErrors>
        <DevRootHTTPAccessFallbackBoundary>
          <HTTPAccessFallbackBoundary notFound={<NotAllowedRootHTTPFallbackError>}>
            <HTTPAccessFallbackErrorBoundary pathname="/login" notFound={<NotAllowedRootHTTPFallbackError>} ...>
              <RedirectBoundary>
                <RedirectErrorBoundary router={{...}}>
                  <Head>
                  <__next_root_layout_boundary__>
                    <SegmentViewNode type="layout" pagePath="layout.js">
                      <SegmentTrieNode>
                      <link>
                      <script>
                      <script>
                      <script>
                      <RootLayout>
                        <html
                          lang="en"
-                         __gcrremoteframetoken="32be12cc2ed7591f718390a3b875c7cf"
                        >
                          ...
                            <LoginPage params={Promise} searchParams={Promise}>
                              <div className="page-modul...">
                                <div>
                                <div className="page-modul...">
                                  <div>
                                  <form
                                    onSubmit={function handleSubmit}
                                    className="page-module__1W-6dG__form"
-                                   __gcruniqueid="1"
                                  >
                                    <div className="page-modul...">
                                      <User>
                                      <input
                                        type="text"
                                        placeholder="Username"
                                        value=""
                                        onChange={function onChange}
                                        className="page-module__1W-6dG__input"
                                        autoFocus={true}
-                                       __gcruniqueid="2"
                                      >
                                    <div className="page-modul...">
                                      <Lock>
                                      <input
                                        type="password"
                                        placeholder="Password"
                                        value=""
                                        onChange={function onChange}
                                        className="page-module__1W-6dG__input"
-                                       __gcruniqueid="3"
                                      >
                                    ...
                                  ...
                  ...
app/login/page.js (46:13) @ LoginPage

  44 |           <div className={styles.inputWrap}>
  45 |             <User size={18} className={styles.inputIcon} />
> 46 |             <input
     |             ^
  47 |               type="text"
  48 |               placeholder="Username"
  49 |               value={username}
Call Stack
17
Show 15 ignore-listed frame(s)
input
unknown (0:0)
LoginPage
app/login/page.js (46:13)