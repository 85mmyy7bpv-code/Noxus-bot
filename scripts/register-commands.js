
const { DISCORD_BOT_TOKEN: token,
        DISCORD_APPLICATION_ID: app,
        DISCORD_GUILD_ID: guild } = process.env;

if (!token || !app || !guild) {
  throw new Error("Set all three Discord environment variables.");
}

const commands = [{
  name: "bot",
  description: "Manage NOXUS bots",
  options: [
    { type: 1, name: "scan",
      description: "List bots and their roles" },
    { type: 1, name: "search",
      description: "Search for a bot",
      options: [
        { type: 3, name: "query",
          description: "Bot name or ID", required: true }
      ]},
    { type: 1, name: "organize",
      description: "Assign a category role",
      options: [
        { type: 3, name: "bot_id",
          description: "Bot user ID", required: true },
        { type: 3, name: "category",
          description: "Purpose category", required: true },
        { type: 3, name: "role_id",
          description: "Role ID to assign", required: true }
      ]},
    { type: 1, name: "remove",
      description: "Kick a bot from this server",
      options: [
        { type: 3, name: "bot_id",
          description: "Bot user ID", required: true },
        { type: 5, name: "confirm",
          description: "Confirm the kick", required: true }
      ]}
  ]
}];

const r = await fetch(
  `https://discord.com/api/v10/applications/${app}/guilds/${guild}/commands`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commands)
  }
);

if (!r.ok) throw new Error(await r.text());
console.log("NOXUS commands registered successfully.");
