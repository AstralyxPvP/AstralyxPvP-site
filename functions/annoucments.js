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

  // 1. Fetch channel info first to get guild_id reliably (works for regular channels & threads)
  let guildId = null;
  const channelRes = await fetch(`https://discord.com/api/v10/channels/${channelId}`, { headers });
  
  if (!channelRes.ok) {
    throw new Error(`Discord API Error (${channelRes.status}): Failed to fetch channel details. Check permissions or Channel ID.`);
  }

  const channelData = await channelRes.json();
  guildId = channelData.guild_id;

  // 2. Fetch messages in parallel with guild roles & channels if guildId exists
  const [messagesRes, rolesRes, channelsRes] = await Promise.all([
    fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`, { headers }),
    guildId ? fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }) : Promise.resolve(null),
    guildId ? fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers }) : Promise.resolve(null),
  ]);

  if (!messagesRes.ok) {
    throw new Error(`Discord API Error (${messagesRes.status}): ${messagesRes.statusText}`);
  }

  const rawMessages = await messagesRes.json();
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) return {};

  let guildRoles = [];
  let guildChannelsMap = new Map();

  if (rolesRes && rolesRes.ok) {
    guildRoles = await rolesRes.json();
  } else if (rolesRes) {
    console.warn(`Failed to fetch roles (${rolesRes.status}). Check if bot has 'Manage Roles' or server member access.`);
  }

  if (channelsRes && channelsRes.ok) {
    const channels = await channelsRes.json();
    if (Array.isArray(channels)) {
      channels.forEach(ch => guildChannelsMap.set(ch.id, ch.name));
    }
  }

  const roleMap = new Map(guildRoles.map(r => [r.id, r]));

  // Helper to resolve the user's highest role by position
  const getHighestRole = (memberRoles = []) => {
    if (!guildRoles.length) return "Member";

    // Sort descending by position (highest position = top role)
    const sortedGuildRoles = [...guildRoles].sort((a, b) => b.position - a.position);
    const userRoleIds = new Set(Array.isArray(memberRoles) ? memberRoles : []);

    const highest = sortedGuildRoles.find((role) => userRoleIds.has(role.id));

    if (highest && highest.name !== "@everyone") {
      return highest.name;
    }

    return "Member";
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