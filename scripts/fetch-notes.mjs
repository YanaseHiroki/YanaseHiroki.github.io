// note の最新記事を notes.json に書き出す。node scripts/fetch-notes.mjs で流し、差分が出たら notes.json をコミットする
// （日曜の定期ルーティン「note の既存記事を最新化する」が毎週流す）
// note の RSS は CORS を許していないので、ページから直接は読めない。ここで同じ場所に置いておく。
// 本文は RSS（公開の配信口）から。見出し画像とハッシュタグは非公式 API で補い、失敗しても RSS だけで書く。
import { writeFile, readFile } from "node:fs/promises";

const USER = "yanasehiroki";
const MAX = 12;
const OUT = new URL("../notes.json", import.meta.url);

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]).trim() : "";
};
// 本文の段落をテキストにする
const paragraphs = (html) =>
  [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map(([, p]) => p.replace(/<br\s*\/?>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
// 抜粋は段落を 120 字まで。連載の前置きのように複数の記事で同じ段落は飛ばす
const excerpt = (paras, shared) => {
  const text = paras.filter((p) => !shared.has(p)).join(" ");
  return text.length > 120 ? text.slice(0, 119) + "…" : text;
};

async function fromRss() {
  const res = await fetch(`https://note.com/${USER}/rss`);
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, MAX).map(([, item]) => item);
  const paras = items.map((item) => paragraphs(tag(item, "description")));
  const seen = new Map();
  for (const p of paras.flat()) seen.set(p, (seen.get(p) ?? 0) + 1);
  const shared = new Set([...seen].filter(([, n]) => n > 1).map(([p]) => p));
  return items.map((item, i) => ({
    title: tag(item, "title"),
    url: tag(item, "link"),
    date: new Date(tag(item, "pubDate")).toISOString(),
    image: tag(item, "media:thumbnail") || null,
    excerpt: excerpt(paras[i], shared),
    tags: [],
    paid: false,
  }));
}

async function enrich(notes) {
  try {
    const res = await fetch(`https://note.com/api/v2/creators/${USER}/contents?kind=note&page=1`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const byUrl = new Map(
      (await res.json()).data.contents.map((c) => [c.noteUrl, c]),
    );
    for (const n of notes) {
      const c = byUrl.get(n.url);
      if (!c) continue;
      if (c.eyecatch) n.image = c.eyecatch.replace(/([?&])width=\d+/, "$1width=640");
      n.tags = (c.hashtags ?? []).map((h) => h.hashtag.name.replace(/^#/, "")).slice(0, 3);
      n.paid = (c.price ?? 0) > 0;
    }
  } catch (e) {
    console.warn(`補足情報は取れなかった（RSS だけで書く）: ${e.message}`);
  }
  return notes;
}

const notes = await enrich(await fromRss());
if (notes.length === 0) throw new Error("記事が0件。書き出さずに止める");
const body = JSON.stringify({ profile: `https://note.com/${USER}`, notes }, null, 2) + "\n";
const prev = await readFile(OUT, "utf8").catch(() => "");
if (prev === body) {
  console.log("変化なし");
} else {
  await writeFile(OUT, body);
  console.log(`${notes.length} 件を書き出した`);
}
