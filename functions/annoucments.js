// Generates a secure session token using HMAC-SHA256
async function createSessionToken(secret) {
  const data = `session_${Date.now()}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const hashHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${data}.${hashHex}`;
}

// Securely verifies the HMAC signature of an incoming session token
async function verifySessionToken(token, secret) {
  if (!token || !token.startsWith("session_") || !token.includes(".")) {
    return false;
  }

  const [data, providedSignature] = token.split(".");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedSignatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );
  const expectedSignature = Array.from(new Uint8Array(expectedSignatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return providedSignature === expectedSignature;
}

function decimalToHex(decimalColor) {
  if (!decimalColor) return "#5865F2";
  return `#${decimalColor.toString(16).padStart(6, "0")}`;
}

async function fetchChannelContent(channelId, botKey, limit = 50) {
  const headers = {
    Authorization: `Bot ${botKey}`,
    "Content-Type": "application/json",
  };

  const messagesResponse = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`,
    { headers }
  );

  if (!messagesResponse.ok) {
    throw new Error(
      `Discord API Error (${messagesResponse.status}): ${messagesResponse.statusText}`
    );
  }

  const rawMessages = await messagesResponse.json();
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) return {};

  const guildId = "1477025023800901766";
  let guildRoles = [];
  let guildChannelsMap = new Map();

  if (guildId) {
    try {
      const [rolesRes, channelsRes, threadsRes] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }),
        fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers }),
        fetch(`https://discord.com/api/v10/guilds/${guildId}/threads/active`, { headers }),
      ]);

      if (rolesRes.ok) {
        guildRoles = await rolesRes.json();
      }

      const rawChannels = channelsRes.ok ? await channelsRes.json() : [];
      const rawThreads = threadsRes.ok ? (await threadsRes.json()).threads || [] : [];

      [...rawChannels, ...rawThreads].forEach((ch) => {
        guildChannelsMap.set(ch.id, {
          id: ch.id,
          name: ch.name,
          type: ch.type,
          parentId: ch.parent_id || null,
        });
      });
    } catch (e) {
      console.warn("Failed to fetch guild metadata:", e);
    }
  }

  const roleMap = new Map(guildRoles.map((r) => [r.id, r]));
  const memberRolesCache = new Map();

  const getUserRoles = async (userId, msgMember) => {
    if (msgMember?.roles && Array.isArray(msgMember.roles)) return msgMember.roles;
    if (memberRolesCache.has(userId)) return memberRolesCache.get(userId);
    if (!guildId || !userId) return [];

    try {
      const res = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
        { headers }
      );
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
    return highest && highest.name !== "@everyone" ? highest.name : "Member";
  };

  const getChannelMetadata = (chId) => {
    const ch = guildChannelsMap.get(chId);
    if (!ch) return { id: chId, name: "channel", isThread: false, parentName: null, type: 0 };

    const isThread =
      [10, 11, 12].includes(ch.type) ||
      Boolean(
        ch.parentId &&
          guildChannelsMap.has(ch.parentId) &&
          [0, 5].includes(guildChannelsMap.get(ch.parentId)?.type)
      );
    let parentName = null;
    if (isThread && ch.parentId) {
      parentName = guildChannelsMap.get(ch.parentId)?.name || null;
    }

    return {
      id: ch.id,
      name: ch.name,
      type: ch.type,
      isThread: isThread,
      parentName: parentName,
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
      channels: [],
    };

    const channelMatches = [...content.matchAll(/<#(\d+)>/g)];
    const processedChannelIds = new Set();
    for (const match of channelMatches) {
      const chId = match[1];
      if (!processedChannelIds.has(chId)) {
        processedChannelIds.add(chId);
        mentionsMetadata.channels.push(getChannelMetadata(chId));
      }
    }

    const msgLinkMatches = [
      ...content.matchAll(
        /https:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/(?:\d+|@me)\/(\d+)\/\d+/g
      ),
    ];
    for (const match of msgLinkMatches) {
      const chId = match[1];
      if (!processedChannelIds.has(chId)) {
        processedChannelIds.add(chId);
        mentionsMetadata.channels.push(getChannelMetadata(chId));
      }
    }

    if (Array.isArray(msg.mentions)) {
      msg.mentions.forEach((u) => {
        mentionsMetadata.users.push({
          id: u.id,
          username: u.username,
          displayName: u.global_name || u.username,
          color: "#3897f0",
        });
      });
    }

    if (Array.isArray(msg.mention_roles)) {
      msg.mention_roles.forEach((roleId) => {
        const roleData = roleMap.get(roleId);
        if (roleData) {
          mentionsMetadata.roles.push({
            id: roleId,
            name: roleData.name,
            color: decimalToHex(roleData.color),
          });
        }
      });
    }

    let avatarUrl;
    if (msg.author?.avatar) {
      const ext = msg.author.avatar.startsWith("a_") ? "gif" : "png";
      avatarUrl = `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.${ext}?size=128`;
    } else {
      const defaultIndex = msg.author?.id
        ? Number((BigInt(msg.author.id) >> 22n) % 6n)
        : 0;
      avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    }

    const imageAttachments = (msg.attachments || [])
      .filter((att) => att.content_type && att.content_type.startsWith("image/"))
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
        displayName:
          msg.member?.nick ||
          msg.author?.global_name ||
          msg.author?.username ||
          "Unknown User",
        avatarUrl: avatarUrl,
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
  const channelId = "1477033205017346259";

  // 1. Extract tokens from request headers
  const sessionToken = request.headers.get("X-Session-Token");
  const turnstileToken = request.headers.get("X-Turnstile-Token");

  let isAuthorized = false;

  // 2. Validate Session or Turnstile Token
  if (sessionToken) {
    isAuthorized = await verifySessionToken(sessionToken, env.TURNSTILE_SECRET_KEY);
  } else if (turnstileToken) {
    const formData = new FormData();
    formData.append("secret", env.TURNSTILE_SECRET_KEY);
    formData.append("response", turnstileToken);

    const verifyResult = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: formData }
    );
    const verifyData = await verifyResult.json();
    isAuthorized = verifyData.success;
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized access" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!env.BOT_KEY) {
    return new Response(
      JSON.stringify({ error: "BOT_KEY environment variable is missing." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 3. Issue rotated session token for next call
    const nextSessionToken = await createSessionToken(env.TURNSTILE_SECRET_KEY);
    const data = await fetchChannelContent(channelId, env.BOT_KEY);

    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "X-Session-Token",
        "X-Session-Token": nextSessionToken,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "An unexpected error occurred." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}