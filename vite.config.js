import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { defineConfig, loadEnv, createFilter, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // Environment variables are now handled by the envPlugin
    return {
        plugins: [
            react(),
            envPlugin(),
            devServerPlugin(),
            sourcemapPlugin(),
            buildPathPlugin(),
            basePlugin(),
            importPrefixPlugin(),
            htmlPlugin(mode),
            svgrPlugin(),
        ],
    };
});
// Vite automatically loads .env, .env.[mode], and .env.[mode].local files
// Environment variables with VITE_ prefix are exposed to your client-side code
// Access them using import.meta.env.VITE_* in your code
// https://vitejs.dev/guide/env-and-mode.html#env-files
function envPlugin() {
    return {
        name: 'vite-env-plugin',
        config(_, { mode }) {
            // Load all environment variables
            const env = loadEnv(mode, '.', ['VITE_', 'NODE_ENV', 'PUBLIC_URL']);
            
            // For backward compatibility, expose VITE_ prefixed vars to process.env
            const processEnv = {};
            Object.keys(env).forEach(key => {
                if (key.startsWith('VITE_')) {
                    processEnv[`import.meta.env.${key}`] = JSON.stringify(env[key]);
                    processEnv[`process.env.${key}`] = JSON.stringify(env[key]);
                }
            });
            
            // Add NODE_ENV and PUBLIC_URL for compatibility
            if (env.NODE_ENV) {
                processEnv['process.env.NODE_ENV'] = JSON.stringify(env.NODE_ENV);
                processEnv['import.meta.env.MODE'] = JSON.stringify(env.NODE_ENV);
            }
            
            if (env.PUBLIC_URL) {
                processEnv['process.env.PUBLIC_URL'] = JSON.stringify(env.PUBLIC_URL);
                processEnv['import.meta.env.BASE_URL'] = JSON.stringify(env.PUBLIC_URL);
            }
            
            return {
                define: processEnv,
                // Set base URL for static assets
                base: env.PUBLIC_URL || '/',
            };
        },
    };
}
// Setup HOST, SSL, PORT
// Migration guide: Follow the guides below
// https://vitejs.dev/config/server-options.html#server-host
// https://vitejs.dev/config/server-options.html#server-https
// https://vitejs.dev/config/server-options.html#server-port
function devServerPlugin() {
    return {
        name: "dev-server-plugin",
        config(_, { mode }) {
            const { HOST, PORT, HTTPS, SSL_CRT_FILE, SSL_KEY_FILE } = loadEnv(mode, ".", ["HOST", "PORT", "HTTPS", "SSL_CRT_FILE", "SSL_KEY_FILE"]);
            const https = HTTPS === "true";
            return {
                server: {
                    host: HOST || "0.0.0.0",
                    port: parseInt(PORT || "3000", 10),
                    open: true,
                    ...(https &&
                        SSL_CRT_FILE &&
                        SSL_KEY_FILE && {
                        https: {
                            cert: readFileSync(resolve(SSL_CRT_FILE)),
                            key: readFileSync(resolve(SSL_KEY_FILE)),
                        },
                    }),
                },
            };
        },
    };
}
// Migration guide: Follow the guide below
// https://vitejs.dev/config/build-options.html#build-sourcemap
function sourcemapPlugin() {
    return {
        name: "sourcemap-plugin",
        config(_, { mode }) {
            const { GENERATE_SOURCEMAP } = loadEnv(mode, ".", [
                "GENERATE_SOURCEMAP",
            ]);
            return {
                build: {
                    sourcemap: GENERATE_SOURCEMAP === "true",
                },
            };
        },
    };
}
// Migration guide: Follow the guide below
// https://vitejs.dev/config/build-options.html#build-outdir
function buildPathPlugin() {
    return {
        name: "build-path-plugin",
        config(_, { mode }) {
            const { BUILD_PATH } = loadEnv(mode, ".", [
                "BUILD_PATH",
            ]);
            return {
                build: {
                    outDir: BUILD_PATH || "build",
                },
            };
        },
    };
}
// Migration guide: Follow the guide below and remove homepage field in package.json
// https://vitejs.dev/config/shared-options.html#base
function basePlugin() {
    return {
        name: "base-plugin",
        config(_, { mode }) {
            const { PUBLIC_URL } = loadEnv(mode, ".", ["PUBLIC_URL"]);
            return {
                base: PUBLIC_URL || "",
            };
        },
    };
}
// To resolve modules from node_modules, you can prefix paths with ~
// https://create-react-app.dev/docs/adding-a-sass-stylesheet
// Migration guide: Follow the guide below
// https://vitejs.dev/config/shared-options.html#resolve-alias
function importPrefixPlugin() {
    return {
        name: "import-prefix-plugin",
        config() {
            return {
                resolve: {
                    alias: [{ find: /^~([^/])/, replacement: "$1" }],
                },
            };
        },
    };
}
// In Create React App, SVGs can be imported directly as React components. This is achieved by svgr libraries.
// https://create-react-app.dev/docs/adding-images-fonts-and-files/#adding-svgs
function svgrPlugin() {
    const filter = createFilter("**/*.svg");
    const postfixRE = /[?#].*$/s;
    return {
        name: "svgr-plugin",
        async transform(code, id) {
            if (filter(id)) {
                const { transform } = await import("@svgr/core");
                const { default: jsx } = await import("@svgr/plugin-jsx");
                const filePath = id.replace(postfixRE, "");
                const svgCode = readFileSync(filePath, "utf8");
                const componentCode = await transform(svgCode, undefined, {
                    filePath,
                    caller: {
                        previousExport: code,
                        defaultPlugins: [jsx],
                    },
                });
                const res = await transformWithEsbuild(componentCode, id, {
                    loader: "jsx",
                });
                return {
                    code: res.code,
                    map: null,
                };
            }
        },
    };
}
// Replace %ENV_VARIABLES% in index.html
// https://vitejs.dev/guide/api-plugin.html#transformindexhtml
// Migration guide: Follow the guide below, you may need to rename your environment variable to a name that begins with VITE_ instead of REACT_APP_
// https://vitejs.dev/guide/env-and-mode.html#html-env-replacement
function htmlPlugin(mode) {
    const env = loadEnv(mode, ".", ["REACT_APP_", "NODE_ENV", "PUBLIC_URL"]);
    return {
        name: "html-plugin",
        transformIndexHtml: {
            order: "pre",
            handler(html) {
                return html.replace(/%(.*?)%/g, (match, p1) => env[p1] ?? match);
            },
        },
    };
}
