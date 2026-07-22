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
      // Fetch Roles, Guild Channels, and Active Guild Threads in parallel
      const [rolesRes, channelsRes, threadsRes] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }),
        fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers }),
        fetch(`https://discord.com/api/v10/guilds/${guildId}/threads/active`, { headers })
      ]);

      if (rolesRes.ok) {
        guildRoles = await rolesRes.json();
      }

      const rawChannels = channelsRes.ok ? await channelsRes.json() : [];
      const rawThreads = threadsRes.ok ? ((await threadsRes.json()).threads || []) : [];

      // Populate channels & threads into lookup map
      [...rawChannels, ...rawThreads].forEach(ch => {
        guildChannelsMap.set(ch.id, {
          id: ch.id,
          name: ch.name,
          type: ch.type, // 0: Text, 5: Announcement, 10/11/12: Threads
          parentId: ch.parent_id || null
        });
      });
    } catch (e) {
      console.warn("Failed to fetch guild metadata:", e);
    }
  }

  const roleMap = new Map(guildRoles.map(r => [r.id, r]));
  const memberRolesCache = new Map();

  const getUserRoles = async (userId, msgMember) => {
    if (msgMember?.roles && Array.isArray(msgMember.roles)) return msgMember.roles;
    if (memberRolesCache.has(userId)) return memberRolesCache.get(userId);
    if (!guildId || !userId) return [];

    try {
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, { headers });
      if (res.ok) {
        const memberData = await res.json();
        const roles = memberData.roles || [];
        memberRolesCache.set(userId, roles);
        return roles;
      }
    } catch (err) {
      console.warn(`Failed to fetch member details for user ${userId}:`, err);
    }

    memberRolesCache.set(userId, []);
    return [];
  };

  const sortedGuildRoles = [...guildRoles].sort((a, b) => b.position - a.position);

  const getHighestRole = (memberRoles = []) => {
    if (!sortedGuildRoles.length) return "Member";
    const userRoleIds = new Set(Array.isArray(memberRoles) ? memberRoles : []);
    const highest = sortedGuildRoles.find((role) => userRoleIds.has(role.id));
    return (highest && highest.name !== "@everyone") ? highest.name : "Member";
  };

  // Helper to format channel metadata for frontend
  const getChannelMetadata = (chId) => {
    const ch = guildChannelsMap.get(chId);
    if (!ch) return { id: chId, name: "channel", isThread: false, parentName: null, type: 0 };

    const isThread = [10, 11, 12].includes(ch.type) || Boolean(ch.parentId && guildChannelsMap.has(ch.parentId) && [0, 5].includes(guildChannelsMap.get(ch.parentId)?.type));
    let parentName = null;
    if (isThread && ch.parentId) {
      parentName = guildChannelsMap.get(ch.parentId)?.name || null;
    }

    return {
      id: ch.id,
      name: ch.name,
      type: ch.type,
      isThread: isThread,
      parentName: parentName
    };
  };

  const outputDictionary = {};

  for (const msg of rawMessages) {
    const content = msg.content || "";
    const authorId = msg.author?.id;
    const userRoleIds = await getUserRoles(authorId, msg.member);

    const mentionsMetadata = {
      users: [],
      roles: [],
      channels: []
    };

    // Extract raw channel/thread mentions (<#123456789>)
    const channelMatches = [...content.matchAll(/<#(\d+)>/g)];
    const processedChannelIds = new Set();
    for (const match of channelMatches) {
      const chId = match[1];
      if (!processedChannelIds.has(chId)) {
        processedChannelIds.add(chId);
        mentionsMetadata.channels.push(getChannelMetadata(chId));
      }
    }

    // Extract channels from Message Links (https://discord.com/channels/.../CHANNEL_ID/...)
    const msgLinkMatches = [...content.matchAll(/https:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/(?:\d+|@me)\/(\d+)\/\d+/g)];
    for (const match of msgLinkMatches) {
      const chId = match[1];
      if (!processedChannelIds.has(chId)) {
        processedChannelIds.add(chId);
        mentionsMetadata.channels.push(getChannelMetadata(chId));
      }
    }

    // User Mentions
    if (Array.isArray(msg.mentions)) {
      msg.mentions.forEach(u => {
        mentionsMetadata.users.push({
          id: u.id,
          username: u.username,
          displayName: u.global_name || u.username,
          color: "#3897f0"
        });
      });
    }

    // Role Mentions
    if (Array.isArray(msg.mention_roles)) {
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

    // Avatar Construction
    let avatarUrl;
    if (msg.author?.avatar) {
      const ext = msg.author.avatar.startsWith('a_') ? 'gif' : 'png';
      avatarUrl = `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.${ext}?size=128`;
    } else {
      const defaultIndex = msg.author?.id ? Number((BigInt(msg.author.id) >> 22n) % 6n) : 0;
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
      highestRank: getHighestRole(userRoleIds),
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