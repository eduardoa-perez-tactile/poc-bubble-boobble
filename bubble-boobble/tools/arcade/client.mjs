import { readFileSync } from 'node:fs';
import { digest, json } from './release.mjs';
export const origin = 'https://webgames.tactilews.com';
export function validSlug(slug) {
  if (typeof slug !== 'string' || slug.length > 48 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Use a lowercase managed slug of at most 48 characters, separated by hyphens.');
  return slug;
}
export function decodeRpc(body) {
  if (body.error) throw new Error(`Office Arcade JSON-RPC error: ${JSON.stringify(body.error)}`);
  const result = body.result;
  if (!result || result.isError) throw new Error(`Office Arcade tool failed: ${JSON.stringify(result)}`);
  const content = result.content?.find(item => item.type === 'text');
  if (!content) throw new Error('Office Arcade returned no JSON tool result.');
  return JSON.parse(content.text);
}
export async function rpc(name, args = {}, fetcher = fetch) {
  const response = await fetcher(`${origin}/mcp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Office Arcade ${name}: HTTP ${response.status}: ${await response.text()}`);
  return decodeRpc(await response.json());
}
export async function publish({ slug, zip, fetcher = fetch }) {
  validSlug(slug);
  const bytes = readFileSync(zip), receipt = json(`${zip}.json`);
  if (!receipt.ok || receipt.zipSha256 !== digest(bytes) || bytes.length > 1024 ** 3) throw new Error('ZIP requires a matching verified release receipt; run arcade:package first.');
  const games = await rpc('list_games', {}, fetcher);
  if (!Array.isArray(games)) throw new Error('Unexpected list_games result.');
  if (games.some(game => game.slug === slug)) throw new Error('This address already exists; choose a new slug.');
  const prepared = await rpc('prepare_publish', { slug, multiplayer: true }, fetcher);
  const uploadUrl = new URL(prepared.uploadUrl);
  if (uploadUrl.protocol !== 'https:' || uploadUrl.origin !== origin) throw new Error('Unexpected upload destination; review the returned contract before uploading.');
  if (!prepared.headers || typeof prepared.headers !== 'object' || Array.isArray(prepared.headers)) throw new Error('prepare_publish did not return upload headers; review its contract.');
  const response = await fetcher(uploadUrl, { method: 'PUT', headers: prepared.headers, body: bytes, signal: AbortSignal.timeout(300000) });
  if (response.status !== 202) throw new Error(`Upload expected HTTP 202 queued; got ${response.status}: ${await response.text()}`);
  // Deliberately return the queued receipt. Use status explicitly; never claim queued means published.
  return { state: 'queued', slug, upload: await response.text(), next: `npm run arcade:status -- --slug ${slug}`, build: receipt };
}
