import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import "./App.css";
import { CodeEditor } from "./components/CodeEditor";
import { GridResizer } from "./components/GridResizer";

const dispatchKeyboardEventToParentZoomState = () => `
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (!['=', '-'].includes(e.key)) return;

    const options = {
      key: e.key,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
    };
    const keyboardEvent = new KeyboardEvent('keydown', options);
    window.parent.document.dispatchEvent(keyboardEvent);

    e.preventDefault();
  }, true);
`;

const generateHTML = (isDark: boolean, importMap: string) => `
  <!doctype html>
  <html${isDark ? ' class="dark"' : ""}>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      <link href="https://unpkg.com/modern-normalize@1.1.0/modern-normalize.css" rel="stylesheet">
      <script async src="https://ga.jspm.io/npm:es-module-shims@1.7.0/dist/es-module-shims.js"></script>
      <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
      <style>
        html, body {
          position: relative;
          width: 100%;
          height: 100%;
        }

        body {
          color: #333;
          margin: 0;
          padding: 8px;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
          max-width: 100%;
        }

        .dark body {
          color: #e5e7eb;
        }

        .dark {
          color-scheme: dark;
        }

        input, button, select, textarea {
          padding: 0.4em;
          margin: 0 0 0.5em 0;
          box-sizing: border-box;
          border: 1px solid #ccc;
          border-radius: 2px;
        }

        button {
          color: #333;
          background-color: #f4f4f4;
          outline: none;
        }

        button:disabled {
          color: #999;
        }

        button:not(:disabled):active {
          background-color: #ddd;
        }

        button:focus {
          border-color: #666;
        }
      </style>
      <script type="importmap">${importMap}</script>
      <script src="https://cdn.jsdelivr.net/npm/chobitsu"></script>
      <script type="module">
        let finisher = undefined;
        window.addEventListener('message', ({ data }) => {
          const { event, value } = data;

          if (event !== 'CODE_UPDATE') return;

          const next = () => {
            window.dispose?.();
            window.dispose = undefined;
            
            if(document.getElementById('app'))
              document.getElementById('app').innerHTML = "";

            // console.clear();

            document.getElementById('appsrc')?.remove();
            const script = document.createElement('script');
            script.id = 'appsrc';
            script.type = 'module';
            finisher = () => {};
            script.onload = () => {
              if (finisher) finisher();
              finisher = undefined;
            };
            
            // Check if code contains JSX and needs transpilation
            const containsJSX = /<[A-Z]|<[a-z]/.test(value);
            
            let blobUrl
            if (containsJSX) {
              // Use Babel standalone to transpile JSX
              try {
                const transformedCode = window.Babel.transform(value, {
                  presets: ['react'],
                  plugins: []
                }).code;
                
                // Send transpiled code to parent
                window.parent.postMessage({
                  event: 'TRANSPILED_CODE',
                  value: transformedCode
                }, '*');
                
                const blob = new Blob([transformedCode], { type: 'application/javascript' });
                blobUrl = URL.createObjectURL(blob);
                script.src = blobUrl;
              } catch (error) {
                console.error('JSX transpilation error:', error);
                // Send error message as transpiled code
                window.parent.postMessage({
                  event: 'TRANSPILED_CODE',
                  value: '// Transpilation Error:\\n// ' + error.message + '\\n\\n' + value
                }, '*');
                
                // Fallback to original code if transpilation fails
                const blob = new Blob([value], { type: 'application/javascript' });
                blobUrl = URL.createObjectURL(blob);
                script.src = blobUrl;
              }
            } else {
              // Regular JavaScript, no transpilation needed
              // Send original code as "transpiled" code
              window.parent.postMessage({
                event: 'TRANSPILED_CODE',
                value: '// No JSX detected - showing original code:\\n\\n' + value
              }, '*');
              
              const blob = new Blob([value], { type: 'application/javascript' });
              blobUrl = URL.createObjectURL(blob);
              script.src = blobUrl;
            }
            
            // Clean up previous blob URL
            if (window.currentBlobUrl) {
              URL.revokeObjectURL(window.currentBlobUrl);
            }
            window.currentBlobUrl = blobUrl;
            
            document.body.appendChild(script);

            const load = document.getElementById('load');
            if (load) load.remove();
          }
          if (finisher !== undefined) {
            finisher = next;
          } else {
            next();
          }
        });

        const sendToDevtools = (message) => {
          window.parent.postMessage(JSON.stringify(message), '*');
        };
        let id = 0;
        const sendToChobitsu = (message) => {
          message.id = 'tmp' + ++id;
          chobitsu.sendRawMessage(JSON.stringify(message));
        };
        chobitsu.setOnMessage((message) => {
          if (message.includes('"id":"tmp')) return;
          window.parent.postMessage(message, '*');
        });
        window.addEventListener('message', ({ data }) => {
          try {
            const { event, value } = data;
            if (event === 'DEV') {
              chobitsu.sendRawMessage(data.data);
            } else if (event === 'LOADED') {
              sendToDevtools({
                method: 'Page.frameNavigated',
                params: {
                  frame: {
                    id: '1',
                    mimeType: 'text/html',
                    securityOrigin: location.origin,
                    url: location.href,
                  },
                  type: 'Navigation',
                },
              });
              sendToChobitsu({ method: 'Network.enable' });
              sendToDevtools({ method: 'Runtime.executionContextsCleared' });
              sendToChobitsu({ method: 'Runtime.enable' });
              sendToChobitsu({ method: 'Debugger.enable' });
              sendToChobitsu({ method: 'DOMStorage.enable' });
              sendToChobitsu({ method: 'DOM.enable' });
              sendToChobitsu({ method: 'CSS.enable' });
              sendToChobitsu({ method: 'Overlay.enable' });
              sendToDevtools({ method: 'DOM.documentUpdated' });
            }
          } catch (e) {
            console.error(e);
          }
        });

        ${dispatchKeyboardEventToParentZoomState()}
      </script>
    </head>
    <body>
      <div id="load" style="display: flex; height: 80vh; align-items: center; justify-content: center;">
        <p style="font-size: 1.5rem">Loading the playground...</p>
      </div>
      <div id="app"></div>
      <script id="appsrc" type="module"></script>
    </body>
  </html>`;

interface PreviewProps {
  importMap: Record<string, string>;
  code: string;
  reloadSignal: boolean;
  isDark: boolean;
  onIframeLoaded: () => void;
}

const Preview: React.FC<PreviewProps> = memo(({
  importMap,
  code,
  reloadSignal,
  isDark,
  onIframeLoaded,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeReady, setIsIframeReady] = useState(false);

  // Generate iframe src URL
  const iframeSrcUrl = useMemo(() => {
    const html = generateHTML(isDark, JSON.stringify({ imports: importMap }));
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));

    // Cleanup previous URL when component unmounts or when new URL is created
    return url;
  }, [isDark, importMap]);



  // Handle dark mode toggle
  useEffect(() => {
    if (!isIframeReady || !iframeRef.current?.contentDocument) return;

    iframeRef.current.contentDocument.documentElement.classList.toggle(
      "dark",
      isDark
    );
  }, [isDark, isIframeReady]);

  // Handle reload signal
  useEffect(() => {
    if (!reloadSignal || !iframeRef.current) return;

    setIsIframeReady(false);
    iframeRef.current.src = iframeSrcUrl;
  }, [reloadSignal, iframeSrcUrl]);

  // Handle code updates
  useEffect(() => {
    if (!isIframeReady || !iframeRef.current?.contentWindow || !code) return;

    iframeRef.current.contentWindow.postMessage(
      { event: "CODE_UPDATE", value: code },
      "*"
    );
  }, [code, isIframeReady]);

  const handleIframeLoad = useCallback(() => {
    setIsIframeReady(true);
    onIframeLoaded()

    // Notify DevTools that preview is loaded
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ event: "LOADED" }, "*");
    }

    if (code && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { event: "CODE_UPDATE", value: code },
        "*"
      );
    }
    if (iframeRef.current?.contentDocument) {
      iframeRef.current.contentDocument.documentElement.classList.toggle(
        "dark",
        isDark
      );
    }
  }, [code, isDark, onIframeLoaded]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <iframe
        ref={iframeRef}
        title="Code Preview"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
          backgroundColor: isDark ? "#1a1a1a" : "white",
        }}
        src={iframeSrcUrl}
        onLoad={handleIframeLoad}
        sandbox="allow-popups-to-escape-sandbox allow-scripts allow-popups allow-forms allow-pointer-lock allow-top-navigation allow-modals allow-same-origin"
      />
    </div>
  );
});

function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved !== null ? saved === "true" : false;
  });
  const [devtools, setDevtools] = useState(false);
  const [reloadSignal, setReloadSignal] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'transpiled'>('preview');

  // Container refs for resizing calculations
  const containerRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const devtoolsRef = useRef<HTMLDivElement>(null);

  // Initialize CSS custom properties for layout
  useEffect(() => {
    if (containerRef.current) {
      const root = containerRef.current;
      root.style.setProperty('--left-panel-width', '50%');
      root.style.setProperty('--right-top-height', '60%');
    }
  }, []);

  // Persist dark mode to localStorage
  useEffect(() => {
    localStorage.setItem("darkMode", String(isDark));
  }, [isDark]);
  
  // State for transpiled code
  const [transpiledCode, setTranspiledCode] = useState('');

  // Sample code for testing
  const [code, setCode] = useState(`// Simple React component example
import React from 'react';
import ReactDOM from 'react-dom/client';

function HelloWorld() {
  const [count, setCount] = React.useState(0);
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Hello, Playground! 🚀</h1>
      <p>Count: {count}</p>
      <button 
        onClick={() => setCount(count + 1)}
        style={{ 
          padding: '10px 20px', 
          fontSize: '16px',
          backgroundColor: '#007acc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginRight: '10px'
        }}
      >
        Click me!
      </button>
      <button 
        onClick={() => setCount(0)}
        style={{ 
          padding: '10px 20px', 
          fontSize: '16px',
          backgroundColor: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Reset
      </button>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<HelloWorld />);`);

  const importMap = {
    react: "https://esm.sh/react@18",
    "react-dom": "https://esm.sh/react-dom@18",
    "react-dom/client": "https://esm.sh/react-dom@18/client",
  };

  const handleReload = () => {
    setReloadSignal(!reloadSignal);
  };

  // DevTools communication
  useEffect(() => {
    const messageListener = (event: MessageEvent) => {
      // Forward messages between preview and devtools
      const previewIframe = previewRef.current?.querySelector("iframe");
      const devtoolsIframe = devtoolsRef.current?.querySelector("iframe");
      console.log("Parent received message:", event.data);
      if (
        event.source === previewIframe?.contentWindow &&
        devtoolsIframe?.contentWindow
      ) {
        devtoolsIframe.contentWindow.postMessage(event.data, "*");
      }
      if (
        event.source === devtoolsIframe?.contentWindow &&
        previewIframe?.contentWindow
      ) {
        previewIframe.contentWindow.postMessage(
          { event: "DEV", data: event.data },
          "*"
        );
      }
      
      // Handle transpiled code updates from iframe
      if (event.data?.event === 'TRANSPILED_CODE') {
        setTranspiledCode(event.data.value);
      }
    };

    window.addEventListener("message", messageListener);
    return () => window.removeEventListener("message", messageListener);
  }, []);

  // Handle horizontal resizing (left vs right panels)
  const handleHorizontalResize = useCallback((clientX: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const percentage = (clientX - rect.left) / rect.width;
    const clampedPercentage = Math.max(0.2, Math.min(0.8, percentage));

    // Update CSS custom property directly - no state update needed
    containerRef.current.style.setProperty('--left-panel-width', `${clampedPercentage * 100}%`);
  }, []);

  // Handle vertical resizing (right panel top vs bottom)
  const handleVerticalResize = useCallback((clientY: number) => {
    if (!rightPanelRef.current || !containerRef.current) return;

    const rect = rightPanelRef.current.getBoundingClientRect();
    const percentage = (clientY - rect.top) / rect.height;
    const clampedPercentage = Math.max(0.2, Math.min(0.8, percentage));

    // Update CSS custom property directly - no state update needed
    containerRef.current.style.setProperty('--right-top-height', `${clampedPercentage * 100}%`);
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Controls */}
      <div
        style={{
          padding: "10px",
          backgroundColor: isDark ? "#2d2d2d" : "#f5f5f5",
          borderBottom: "1px solid #ccc",
          display: "flex",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <button onClick={() => setIsDark(!isDark)}>
          {isDark ? "☀️ Light" : "🌙 Dark"}
        </button>
        <button onClick={() => setDevtools(!devtools)}>
          {devtools ? "Hide DevTools" : "Show DevTools"}
        </button>
        <button onClick={handleReload}>🔄 Reload</button>
        <span style={{ color: isDark ? "#fff" : "#333" }}>
          Code Playground with DevTools
        </span>
      </div>

      {/* Main Layout */}
      <div
        ref={containerRef}
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* Left Panel - Code Editor */}
        <div
          style={{
            width: "var(--left-panel-width)",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <CodeEditor
            value={code}
            onChange={setCode}
            language="javascript"
            isDark={isDark}
          />
        </div>

        {/* Vertical Resizer */}
        <GridResizer isHorizontal={false} onResize={handleHorizontalResize} />

        {/* Right Panel - Preview & DevTools */}
        <div
          ref={rightPanelRef}
          style={{
            width: "calc(100% - var(--left-panel-width))",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Preview with Tabs */}
          <div
            ref={previewRef}
            style={{
              height: (devtools && activeTab === 'preview') ? "var(--right-top-height)" : "100%",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Tab Headers */}
            <div style={{
              display: "flex",
              backgroundColor: isDark ? "#1e1e1e" : "#f0f0f0",
              borderBottom: `1px solid ${isDark ? "#333" : "#ccc"}`,
              height: "40px"
            }}>
              <button
                onClick={() => setActiveTab('preview')}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  backgroundColor: activeTab === 'preview' 
                    ? (isDark ? "#333" : "white") 
                    : "transparent",
                  color: isDark ? "#fff" : "#333",
                  cursor: "pointer",
                  borderBottom: activeTab === 'preview' 
                    ? `2px solid ${isDark ? "#007acc" : "#007acc"}` 
                    : "none"
                }}
              >
                🌐 Preview
              </button>
              <button
                onClick={() => setActiveTab('transpiled')}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  backgroundColor: activeTab === 'transpiled' 
                    ? (isDark ? "#333" : "white") 
                    : "transparent",
                  color: isDark ? "#fff" : "#333",
                  cursor: "pointer",
                  borderBottom: activeTab === 'transpiled' 
                    ? `2px solid ${isDark ? "#007acc" : "#007acc"}` 
                    : "none"
                }}
              >
                🔧 Transpiled
              </button>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              {activeTab === 'preview' ? (
                <Preview
                  importMap={importMap}
                  code={code}
                  reloadSignal={reloadSignal}
                  isDark={isDark}
                  onIframeLoaded={() => setDevtools(true)}
                />
              ) : (
                <CodeEditor
                  value={transpiledCode || '// Transpiled code will appear here...'}
                  onChange={() => {}} // Read-only
                  language="javascript"
                  isDark={isDark}
                  readOnly={true}
                />
              )}
            </div>
          </div>

          {/* Horizontal Resizer (only show if devtools is enabled AND preview tab is active) */}
          {devtools && activeTab === 'preview' && (
            <GridResizer
              isHorizontal={true}
              onResize={(_, clientY) => handleVerticalResize(clientY)}
            />
          )}

          {/* DevTools (only show if devtools is enabled AND preview tab is active) */}
          {devtools && activeTab === 'preview' && (
            <div
              ref={devtoolsRef}
              style={{
                height: "calc(100% - var(--right-top-height))",
                overflow: "hidden",
              }}
            >
              <DevToolsPanel isDark={isDark} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Separate DevTools component
const DevToolsPanel: React.FC<{ isDark: boolean }> = memo(({ isDark }) => {
  const devtoolsIframeRef = useRef<HTMLIFrameElement>(null);

  const useDevtoolsSrc = () => {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <meta charset="utf-8">
    <title>DevTools</title>
    <style>
      @media (prefers-color-scheme: dark) {
        body {
          background-color: rgb(41 42 45);
        }
      }
    </style>
    <script>
      ${dispatchKeyboardEventToParentZoomState()}
    </script>
    <meta name="referrer" content="no-referrer">
    <script src="https://unpkg.com/@ungap/custom-elements/es.js"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/chii@1.12.3/public/front_end/entrypoints/chii_app/chii_app.js"></script>
    <body class="undocked" id="-blink-dev-tools">`;

    return useMemo(() => {
      const devtoolsRawUrl = URL.createObjectURL(
        new Blob([html], { type: "text/html" })
      );
      return `${devtoolsRawUrl}#?embedded=${encodeURIComponent(
        location.origin
      )}`;
    }, [html]);
  };

  const devtoolsSrc = useDevtoolsSrc();

  // Handle DevTools theme changes
  useEffect(() => {
    localStorage.setItem("uiTheme", isDark ? '"dark"' : '"default"');
    if (devtoolsIframeRef.current?.contentWindow) {
      devtoolsIframeRef.current.contentDocument?.documentElement.classList.toggle(
        "-theme-with-dark-background",
        isDark
      );
    }
  }, [isDark]);

  return (
    <iframe
      ref={devtoolsIframeRef}
      title="DevTools"
      style={{
        width: "100%",
        height: "100%",
        border: "none",
      }}
      src={devtoolsSrc}
    />
  );
});

export default App;
