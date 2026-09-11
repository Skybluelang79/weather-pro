import serverless from 'serverless-http';
import appModule from './_shared/app.js';

function unwrapDefault(m) {
  let v = m;
  while (
    v != null &&
    typeof v === 'object' &&
    v.default !== undefined &&
    !(typeof v.handle === 'function')
  ) {
    v = v.default;
  }
  return v;
}

const app = unwrapDefault(appModule);
const adapter = unwrapDefault(serverless);

export const handler = adapter(app);