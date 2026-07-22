/**
 * Helper to convert decimal color to Hex (#RRGGBB)
 */
function decimalToHex(decimalColor) {
  if (!decimalColor) return "#5865F2"; // Default Discord blurple
  return `#${decimalColor.toString(16).padStart(6, '0')}`;
}

/**
 * Fetch and parse channel content with full mention metadata
 */
async function fetchChannelContent(channelId, botKey, limit = 50) {
  const headers = {
    'Authorization': `Bot ${botKey}`,
    'Content-Type': 'application/json',
  };

  // 1. Fetch channel messages via Discord REST API
  const messagesResponse = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`,
    { headers }
  );

  if (!messagesResponse.ok) {
    throw new Error(`Discord API Error (${messagesResponse.status}): ${messagesResponse.statusText}`);
  }

  const rawMessages = await messagesResponse.json();
  if (rawMessages.length === 0) return {};

  const guildId = rawMessages[0].guild_id;

  // 2. Fetch Guild Roles & Channels in parallel
  let guildRoles = [];
  let guildChannelsMap = new Map();

  if (guildId) {
    const [rolesRes, channelsRes] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers })
    ]);

    if (rolesRes.ok) guildRoles = await rolesRes.json();
    if (channelsRes.ok) {
      const channels = await channelsRes.json();
      channels.forEach(ch => guildChannelsMap.set(ch.id, ch.name));
    }
  }

  const roleMap = new Map(guildRoles.map(r => [r.id, r]));

  // Helper function to resolve highest role name from role IDs
  const getHighestRole = (memberRoles = []) => {
    if (!memberRoles.length || !guildRoles.length) return "@everyone";
    const sortedGuildRoles = [...guildRoles].sort((a, b) => b.position - a.position);
    const highest = sortedGuildRoles.find((role) => memberRoles.includes(role.id));
    return highest ? highest.name : "@everyone";
  };

  const outputDictionary = {};

  // 3. Process every message
  for (const msg of rawMessages) {
    const content = msg.content || "";

    const mentionsMetadata = {
      users: [],
      roles: [],
      channels: [] // Extracted channels for blue bubble rendering
    };

    // Extract all channel mentions (<#channel_id>)
    const channelMatches = [...content.matchAll(/<#(\d+)>/g)];
    const processedChannelIds = new Set();

    for (const match of channelMatches) {
      const chId = match[1];
      if (!processedChannelIds.has(chId)) {
        processedChannelIds.add(chId);
        const name = guildChannelsMap.get(chId) || "unknown-channel";
        mentionsMetadata.channels.push({
          id: chId,
          name: `#${name}`,
          color: "#3897f0" // Blue color indicator for frontend bubble styling
        });
      }
    }

    // Process user mentions (<@123> or <@!123>)
    if (msg.mentions && msg.mentions.length > 0) {
      msg.mentions.forEach(u => {
        mentionsMetadata.users.push({
          id: u.id,
          username: u.username,
          displayName: u.global_name || u.username,
          color: "#3897f0" // User color (blue)
        });
      });
    }

    // Process role mentions (<@&123>)
    if (msg.mention_roles && msg.mention_roles.length > 0) {
      msg.mention_roles.forEach(roleId => {
        const roleData = roleMap.get(roleId);
        if (roleData) {
          mentionsMetadata.roles.push({
            id: roleId,
            name: roleData.name,
            color: decimalToHex(roleData.color)
          });
        }
      });
    }

    // Extract images
    const imageAttachments = (msg.attachments || [])
      .filter((att) => att.content_type && att.content_type.startsWith('image/'))
      .map((att) => att.url);

    const embedImages = (msg.embeds || [])
      .filter((embed) => embed.image && embed.image.url)
      .map((embed) => embed.image.url);

    // Structure response
    outputDictionary[msg.id] = {
      content: content, // Preserves <#1477033205017346259> intact
      timestamp: msg.timestamp,
      user: {
        id: msg.author.id,
        username: msg.author.username,
        displayName: msg.member?.nick || msg.author.global_name || msg.author.username,
      },
      highestRank: getHighestRole(msg.member?.roles),
      mentions: mentionsMetadata,
      embeds: msg.embeds || [],
      pictures: [...imageAttachments, ...embedImages],
    };
  }

  return outputDictionary;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const channelId = url.searchParams.get("channelId") || "1477033205017346259";

  if (!env.BOT_KEY) {
    return new Response(
      JSON.stringify({ error: "BOT_KEY environment variable is missing." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const data = await fetchChannelContent(channelId, env.BOT_KEY);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}