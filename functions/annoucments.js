/**
 * Helper to convert decimal color to Hex (#RRGGBB)
 */
function decimalToHex(decimalColor) {
  if (!decimalColor) return "#5865F2";
  return `#${decimalColor.toString(16).padStart(6, '0')}`;
}

async function fetchChannelContent(channelId, botKey, limit = 50) {
  const headers = {
    'Authorization': `Bot ${botKey}`,
    'Content-Type': 'application/json',
  };

  const messagesResponse = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`,
    { headers }
  );

  if (!messagesResponse.ok) {
    throw new Error(`Discord API Error (${messagesResponse.status}): ${messagesResponse.statusText}`);
  }

  const rawMessages = await messagesResponse.json();
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) return {};

  const guildId = "1477025023800901766";
  let guildRoles = [];
  let guildChannelsMap = new Map();

  if (guildId) {
    try {
      const [rolesRes, channelsRes] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }),
        fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers })
      ]);

      if (rolesRes.ok) guildRoles = await rolesRes.json();
      if (channelsRes.ok) {
        const channels = await channelsRes.json();
        if (Array.isArray(channels)) {
          channels.forEach(ch => guildChannelsMap.set(ch.id, ch.name));
        }
      }
    } catch (e) {
      console.warn("Failed to fetch guild roles or channels metadata:", e);
    }
  }

  const roleMap = new Map(guildRoles.map(r => [r.id, r]));

  // Pre-sort guild roles by hierarchy position descending (highest role first)
  const sortedGuildRoles = [...guildRoles].sort((a, b) => b.position - a.position);

  // Helper function to find highest role name from raw role IDs
  const getHighestRole = (memberRoles = []) => {
    if (!sortedGuildRoles.length || !Array.isArray(memberRoles) || memberRoles.length === 0) {
      return "Member";
    }

    const userRoleIds = new Set(memberRoles);

    // Find the first role in sorted order that the user possesses
    const highest = sortedGuildRoles.find(
      (role) => userRoleIds.has(role.id) && role.name !== "@everyone"
    );

    return highest ? highest.name : "Member";
  };

  const outputDictionary = {};

  for (const msg of rawMessages) {
    const content = msg.content || "";

    const mentionsMetadata = {
      users: [],
      roles: [],
      channels: []
    };

    // Channel Mentions (<#123456789>)
    const channelMatches = [...content.matchAll(/<#(\d+)>/g)];
    const processedChannelIds = new Set();
    for (const match of channelMatches) {
      const chId = match[1];
      if (!processedChannelIds.has(chId)) {
        processedChannelIds.add(chId);
        const name = guildChannelsMap.get(chId) || "channel";
        mentionsMetadata.channels.push({
          id: chId,
          name: `#${name}`,
          color: "#3897f0"
        });
      }
    }

    // User Mentions (<@123456789>)
    if (Array.isArray(msg.mentions) && msg.mentions.length > 0) {
      msg.mentions.forEach(u => {
        mentionsMetadata.users.push({
          id: u.id,
          username: u.username,
          displayName: u.global_name || u.username,
          color: "#3897f0"
        });
      });
    }

    // Role Mentions (<@&123456789>)
    if (Array.isArray(msg.mention_roles) && msg.mention_roles.length > 0) {
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

    // Discord Avatar Construction
    let avatarUrl;
    if (msg.author && msg.author.avatar) {
      const ext = msg.author.avatar.startsWith('a_') ? 'gif' : 'png';
      avatarUrl = `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.${ext}?size=128`;
    } else {
      const defaultIndex = msg.author?.id 
        ? Number((BigInt(msg.author.id) >> 22n) % 6n) 
        : 0;
      avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    }

    const imageAttachments = (msg.attachments || [])
      .filter((att) => att.content_type && att.content_type.startsWith('image/'))
      .map((att) => att.url);

    const embedImages = (msg.embeds || [])
      .filter((embed) => embed.image && embed.image.url)
      .map((embed) => embed.image.url);

    outputDictionary[msg.id] = {
      content: content,
      timestamp: msg.timestamp,
      user: {
        id: msg.author?.id || "",
        username: msg.author?.username || "Unknown",
        displayName: msg.member?.nick || msg.author?.global_name || msg.author?.username || "Unknown User",
        avatarUrl: avatarUrl
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
      JSON.stringify({ error: err.message || "An unexpected error occurred." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}