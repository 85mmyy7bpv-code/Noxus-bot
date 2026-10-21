
const API = "https://discord.com/api/v10";
const MANAGE_GUILD = 32n;

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("NOXUS Bot Control online");
    }

    const signature = request.headers.get("x-signature-ed25519");
    const timestamp = request.headers.get("x-signature-timestamp");
    if (!signature || !timestamp || !env.DISCORD_PUBLIC_KEY) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.text();
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        hex(env.DISCORD_PUBLIC_KEY),
        { name: "Ed25519" },
        false,
        ["verify"]
      );
      const valid = await crypto.subtle.verify(
        { name: "Ed25519" },
        key,
        hex(signature),
        new TextEncoder().encode(timestamp + body)
      );
      if (!valid) return new Response("Invalid signature", { status: 401 });
    } catch {
      return new Response("Signature verification failed", { status: 401 });
    }

    let i;
    try { i = JSON.parse(body); }
    catch { return new Response("Invalid JSON", { status: 400 }); }

    if (i.type === 1) return json({ type: 1 });
    if (i.type !== 2 || i.data?.name !== "bot") {
      return reply("Unknown command.");
    }

    const sub = i.data.options?.[0];
    const opts = Object.fromEntries(
      (sub?.options || []).map(o => [o.name, o.value])
    );

    if (!i.guild_id) return reply("Use this inside your server.");

    const permissions = BigInt(i.member?.permissions || "0");
    if ((permissions & MANAGE_GUILD) !== MANAGE_GUILD) {
      return reply("You need Manage Server permission.");
    }

    if (!env.DISCORD_BOT_TOKEN) {
      return reply("Bot token is missing from Cloudflare secrets.");
    }

    try {
      const guild = i.guild_id;
      const token = env.DISCORD_BOT_TOKEN;

      if (sub.name === "scan" || sub.name === "search") {
        const members = await api(
          `/guilds/${guild}/members?limit=1000`, token
        );
        let bots = members.filter(m => m.user?.bot);

        if (sub.name === "search") {
          const q = String(opts.query || "").toLowerCase();
          bots = bots.filter(m =>
            m.user.username.toLowerCase().includes(q) ||
            m.user.id === q
          );
        }

        if (!bots.length) return reply("No matching bots found.");

        return reply(bots.slice(0, 25).map(m =>
          `• **${clean(m.user.username)}** — \`${m.user.id}\`\n` +
          `Roles: ${(m.roles || []).map(r => `<@&${r}>`).join(", ") || "None"}`
        ).join("\n"));
      }

      if (sub.name === "organize") {
        const id = String(opts.bot_id || "");
        const role = String(opts.role_id || "");
        const category = clean(opts.category || "");

        if (!/^\d{17,20}$/.test(id) ||
            !/^\d{17,20}$/.test(role)) {
          return reply("Invalid bot or role ID.");
        }

        const member = await api(
          `/guilds/${guild}/members/${id}`, token
        );
        if (!member.user?.bot) {
          return reply("That account is not a bot.");
        }

        await api(
          `/guilds/${guild}/members/${id}/roles/${role}`,
          token,
          { method: "PUT" }
        );

        return reply(
          `Organized **${clean(member.user.username)}** into ` +
          `**${category}** using role <@&${role}>.`
        );
      }

      if (sub.name === "remove") {
        const id = String(opts.bot_id || "");

        if (!/^\d{17,20}$/.test(id)) {
          return reply("Invalid bot ID.");
        }
        if (opts.confirm !== true) {
          return reply("No action taken. Set confirm to true to kick the bot.");
        }

        const member = await api(
          `/guilds/${guild}/members/${id}`, token
        );
        if (!member.user?.bot) {
          return reply("Not a bot account. Nothing was removed.");
        }

        await api(`/guilds/${guild}/members/${id}`, token, {
          method: "DELETE"
        });

        return reply(
          `Kicked **${clean(member.user.username)}** from this server. ` +
          "The app integration may still need to be removed in Server Settings → Integrations."
        );
      }

      return reply("Unknown subcommand.");
    } catch (e) {
      return reply(`Action failed: ${clean(e.message || "Discord API error")}`);
    }
  }
};

async function api(path, token, init = {}) {
  const r = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  if (r.status === 204) return null;

  const text = await r.text();
  let data;
  try { data = JSON.parse(text); }
  catch { data = text; }

  if (!r.ok) {
    throw new Error(typeof data === "object"
      ? data?.message || `HTTP ${r.status}`
      : `HTTP ${r.status}`);
  }
  return data;
}

function reply(content) {
  return json({
    type: 4,
    data: {
      content,
      allowed_mentions: { parse: [] }
    }
  });
}

function json(data) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
}

function hex(s) {
  if (!/^[0-9a-f]+$/i.test(s) || s.length % 2) {
    throw new Error("Invalid hex");
  }
  return new Uint8Array(s.match(/.{2}/g).map(x => parseInt(x, 16)));
}

function clean(s) {
  return String(s ?? "")
    .replace(/[`*_~|<>@]/g, "")
    .slice(0, 100);
}
