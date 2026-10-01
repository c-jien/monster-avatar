import { monsterAvatar, monsterAvatarDataUri, monsterTraits, restoreAvatar, traitSchema, traitCompatibility, type AvatarConfig } from 'monster-avatar';
const result = monsterAvatar('id-123', { seedMode: 'raw', traits: { eyes: 'cyclops', hat: 'crown' }, colors: { body: '#abcdef' } });
const config: AvatarConfig = result.config;
restoreAvatar(config, { size: 48, idPrefix: 'one' });
const svg: string = result.svg;
const uri: string = monsterAvatarDataUri('demo');
const hat: string = monsterTraits('demo').hat;
const boolean: boolean = traitSchema.cheeks.values[0];
const rules: readonly unknown[] = traitCompatibility;
// @ts-expect-error Unknown trait choice
monsterAvatar('demo', { traits: { hat: 'baseball' } });
// @ts-expect-error Unknown option
monsterAvatar('demo', { color: '#ffffff' });
// @ts-expect-error Literal colors require hex notation
monsterAvatar('demo', { colors: { body: 'red' } });
