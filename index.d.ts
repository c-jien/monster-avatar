export interface MonsterTraits {
  kind: "blob" | "bust";
  eyes: "pair" | "cyclops" | "triple" | "visor" | "stalks";
  eyeStyle: "round" | "dot" | "sleepy" | "happy" | "wide" | "slit" | "angry" | "lashes";
  mouth: "smile" | "grin" | "fangs" | "teeth" | "o" | "flat" | "wavy" | "cat" | "tongue" | "beak";
  top: "none" | "horns" | "antennae" | "ears-round" | "ears-pointy" | "ears-floppy" | "sprout" | "tuft" | "curl" | "fin" | "stalks";
  hat: "none" | "beanie" | "cap" | "crown" | "party" | "tophat" | "bow" | "flower" | "halo" | "headband" | "headphones";
  face: "none" | "glasses" | "shades" | "monocle" | "mustache" | "bandaid";
  neck: "none" | "scarf" | "bowtie" | "bandana" | "collar" | "beads";
  earring: false | true;
  pattern: "none" | "spots" | "stripes" | "belly" | "patch" | "freckles" | "gradient";
  cheeks: false | true;
  backdrop: "disc" | "none" | "rings" | "dots" | "rays";
}

export type Seed = string | number | null | undefined;
export type SeedMode = 'name' | 'raw';
export type Theme = 'light' | 'dark';
export type HexColor = `#${string}`;
export interface Colors { body?: HexColor; accent?: HexColor; background?: HexColor; ink?: HexColor; }
export interface Presentation { size?: number; idPrefix?: string; }
export interface MonsterOptions extends Presentation {
  seedMode?: SeedMode;
  theme?: Theme;
  traits?: Partial<MonsterTraits>;
  colors?: Colors;
}
export interface AvatarConfig {
  version: 1;
  seed: string;
  seedMode: SeedMode;
  theme: Theme;
  traits: Partial<MonsterTraits>;
  colors: Colors;
}
export interface AvatarResult {
  svg: string;
  traits: MonsterTraits & { key: string; hue: number; tilt: number };
  colors: { body: string; accent: string; background: string; ink: string };
  config: AvatarConfig;
}
export const VERSION: 1;
export const traitSchema: { readonly [K in keyof MonsterTraits]: {
  readonly label: string;
  readonly type: MonsterTraits[K] extends boolean ? 'boolean' : 'enum';
  readonly values: ReadonlyArray<MonsterTraits[K]>;
} };
export const traitCompatibility: ReadonlyArray<{
  readonly traits: readonly [keyof MonsterTraits, keyof MonsterTraits];
  readonly allowed: ReadonlyArray<readonly [string | boolean, string | boolean]>;
}>;
export function monsterAvatar(seed?: Seed, options?: MonsterOptions): AvatarResult;
export function monsterAvatarDataUri(seed?: Seed, options?: MonsterOptions): string;
export function monsterTraits(seed?: Seed, options?: MonsterOptions): MonsterTraits & { key: string };
export function restoreAvatar(config: AvatarConfig, presentation?: Presentation): AvatarResult;
export function normalizeName(name?: Seed): string;
export function hash32(value: string): number;
