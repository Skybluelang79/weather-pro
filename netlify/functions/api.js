import { connectLambda } from '@netlify/blobs';
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
const serverlessHandler = adapter(app);

export const handler = async (event, context) => {
  try {
    connectLambda(event);
  } catch {}
  return serverlessHandler(event, context);
};