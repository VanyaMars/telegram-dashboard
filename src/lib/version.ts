import pkg from '../../package.json';
export const APP_VERSION=pkg.version;
export const BUILD_SHA=(import.meta.env.VITE_BUILD_SHA||'local').slice(0,8);
export const APP_BUILD_LABEL=`Personal OS · v${APP_VERSION} · ${BUILD_SHA}`;
