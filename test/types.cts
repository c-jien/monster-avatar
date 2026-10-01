import avatars = require('monster-avatar');
const result: avatars.AvatarResult = avatars.monsterAvatar('CommonJS', { traits: { cheeks: false } });
avatars.restoreAvatar(result.config);
// @ts-expect-error Invalid boolean trait
avatars.monsterAvatar('demo', { traits: { cheeks: 'yes' } });
