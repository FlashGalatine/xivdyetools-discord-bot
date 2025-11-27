/**
 * Shared mock interaction helpers for Discord.js testing
 * Provides consistent mocking patterns across all command tests
 */

import { vi } from 'vitest';
import type {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  User,
  Guild,
  Client,
  GuildMember,
  TextChannel,
  Attachment,
  CommandInteractionOptionResolver,
} from 'discord.js';

/**
 * Options for creating a mock ChatInputCommandInteraction
 */
export interface MockInteractionOptions {
  /** User ID (default: 'test-user-123') */
  userId?: string;
  /** User locale (default: 'en-US') */
  locale?: string;
  /** Guild ID (default: 'test-guild-123') */
  guildId?: string;
  /** Channel ID (default: 'test-channel-123') */
  channelId?: string;
  /** Whether interaction is deferred (default: false) */
  deferred?: boolean;
  /** Whether interaction is replied (default: false) */
  replied?: boolean;
  /** String options map */
  stringOptions?: Record<string, string | null>;
  /** Integer options map */
  integerOptions?: Record<string, number | null>;
  /** Boolean options map */
  booleanOptions?: Record<string, boolean | null>;
  /** Subcommand name */
  subcommand?: string;
  /** Subcommand group name */
  subcommandGroup?: string;
  /** Attachment option */
  attachment?: Partial<Attachment>;
}

/**
 * Options for creating a mock AutocompleteInteraction
 */
export interface MockAutocompleteOptions {
  /** Focused option name */
  focusedName: string;
  /** Focused option value */
  focusedValue: string;
  /** User ID (default: 'test-user-123') */
  userId?: string;
  /** User locale (default: 'en-US') */
  locale?: string;
}

/**
 * Create a mock Discord User
 */
export function createMockUser(overrides: Record<string, unknown> = {}): User {
  return {
    id: 'test-user-123',
    username: 'TestUser',
    discriminator: '0000',
    avatar: null,
    bot: false,
    system: false,
    ...overrides,
  } as unknown as User;
}

/**
 * Create a mock Discord Guild
 */
export function createMockGuild(overrides: Record<string, unknown> = {}): Guild {
  return {
    id: 'test-guild-123',
    name: 'Test Guild',
    memberCount: 100,
    ...overrides,
  } as unknown as Guild;
}

/**
 * Create a mock Discord GuildMember
 */
export function createMockMember(overrides: Record<string, unknown> = {}): GuildMember {
  return {
    id: 'test-user-123',
    user: createMockUser(),
    displayName: 'TestUser',
    ...overrides,
  } as unknown as GuildMember;
}

/**
 * Create a mock Discord TextChannel
 */
export function createMockChannel(overrides: Record<string, unknown> = {}): TextChannel {
  return {
    id: 'test-channel-123',
    name: 'test-channel',
    type: 0, // GuildText
    send: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as TextChannel;
}

/**
 * Create a mock Discord Client
 */
export function createMockClient(overrides?: Partial<Client>): Client {
  const guildsCache = new Map();
  guildsCache.set('test-guild-123', createMockGuild());

  const usersCache = new Map();
  usersCache.set('test-user-123', createMockUser());

  return {
    user: { id: 'bot-user-123', username: 'TestBot' },
    guilds: {
      cache: guildsCache,
      fetch: vi.fn().mockResolvedValue(guildsCache),
    },
    users: {
      cache: usersCache,
      fetch: vi.fn().mockResolvedValue(createMockUser()),
    },
    application: {
      emojis: {
        fetch: vi.fn().mockResolvedValue(new Map()),
      },
    },
    ...overrides,
  } as unknown as Client;
}

/**
 * Create a mock Attachment
 */
export function createMockAttachment(overrides?: Partial<Attachment>): Attachment {
  return {
    id: 'test-attachment-123',
    name: 'test-image.png',
    url: 'https://cdn.discordapp.com/attachments/123/456/test-image.png',
    proxyURL: 'https://media.discordapp.net/attachments/123/456/test-image.png',
    size: 1024,
    contentType: 'image/png',
    width: 100,
    height: 100,
    ...overrides,
  } as Attachment;
}

/**
 * Create a mock ChatInputCommandInteraction
 */
export function createMockInteraction(
  options: MockInteractionOptions = {}
): ChatInputCommandInteraction {
  const {
    userId = 'test-user-123',
    locale = 'en-US',
    guildId = 'test-guild-123',
    channelId = 'test-channel-123',
    deferred = false,
    replied = false,
    stringOptions = {},
    integerOptions = {},
    booleanOptions = {},
    subcommand,
    subcommandGroup,
    attachment,
  } = options;

  const deferReply = vi.fn().mockResolvedValue(undefined);
  const editReply = vi.fn().mockResolvedValue({
    id: 'mock-message-id',
    channelId,
    guildId,
  });
  const followUp = vi.fn().mockResolvedValue({
    id: 'mock-followup-id',
    channelId,
    guildId,
  });
  const reply = vi.fn().mockResolvedValue({
    id: 'mock-reply-id',
    channelId,
    guildId,
  });
  const deleteReply = vi.fn().mockResolvedValue(undefined);

  const mockInteraction = {
    id: 'test-interaction-123',
    applicationId: 'test-app-123',
    type: 2, // ApplicationCommand
    channelId,
    guildId,
    user: createMockUser({ id: userId, locale }),
    member: createMockMember({ id: userId }),
    guild: createMockGuild({ id: guildId }),
    channel: createMockChannel({ id: channelId }),
    client: createMockClient(),
    locale,
    deferred,
    replied,
    deferReply,
    editReply,
    followUp,
    reply,
    deleteReply,
    isChatInputCommand: () => true,
    isAutocomplete: () => false,
    isRepliable: () => true,
    inGuild: () => true,
    inCachedGuild: () => true,
    options: {
      getString: vi.fn((name: string, _required?: boolean) => {
        return stringOptions[name] ?? null;
      }),
      getInteger: vi.fn((name: string, _required?: boolean) => {
        return integerOptions[name] ?? null;
      }),
      getBoolean: vi.fn((name: string, _required?: boolean) => {
        return booleanOptions[name] ?? null;
      }),
      getSubcommand: vi.fn(() => subcommand ?? null),
      getSubcommandGroup: vi.fn(() => subcommandGroup ?? null),
      getAttachment: vi.fn((name: string, _required?: boolean) => {
        if (name === 'image' && attachment) {
          return createMockAttachment(attachment);
        }
        return null;
      }),
      get: vi.fn(),
      getNumber: vi.fn().mockReturnValue(null),
      getUser: vi.fn().mockReturnValue(null),
      getMember: vi.fn().mockReturnValue(null),
      getRole: vi.fn().mockReturnValue(null),
      getChannel: vi.fn().mockReturnValue(null),
      getMentionable: vi.fn().mockReturnValue(null),
      getMessage: vi.fn().mockReturnValue(null),
      getFocused: vi.fn(),
      data: [],
      resolved: null,
    } as unknown as CommandInteractionOptionResolver,
  } as unknown as ChatInputCommandInteraction;

  return mockInteraction;
}

/**
 * Create a mock AutocompleteInteraction
 */
export function createMockAutocompleteInteraction(
  options: MockAutocompleteOptions
): AutocompleteInteraction {
  const { focusedName, focusedValue, userId = 'test-user-123', locale = 'en-US' } = options;

  const respond = vi.fn().mockResolvedValue(undefined);

  const mockInteraction = {
    id: 'test-autocomplete-123',
    user: createMockUser({ id: userId, locale }),
    locale,
    respond,
    isChatInputCommand: () => false,
    isAutocomplete: () => true,
    options: {
      getFocused: vi.fn((returnFullOption?: boolean) => {
        if (returnFullOption) {
          return { name: focusedName, value: focusedValue };
        }
        return focusedValue;
      }),
      getString: vi.fn().mockReturnValue(null),
      getInteger: vi.fn().mockReturnValue(null),
      getBoolean: vi.fn().mockReturnValue(null),
    },
  } as unknown as AutocompleteInteraction;

  return mockInteraction;
}

/**
 * Helper to extract the first call argument from a mock function
 */
export function getFirstCallArg<T>(mockFn: ReturnType<typeof vi.fn>): T {
  return mockFn.mock.calls[0][0] as T;
}

/**
 * Helper to extract embed data from interaction response
 */
export function getEmbedFromResponse(response: unknown): unknown {
  const res = response as { embeds?: unknown[] };
  return res.embeds?.[0];
}

/**
 * Helper to check if response contains error embed
 */
export function isErrorResponse(response: unknown): boolean {
  const embed = getEmbedFromResponse(response) as { data?: { title?: string } };
  return embed?.data?.title?.includes('❌') ?? false;
}

/**
 * Helper to check if response is ephemeral
 */
export function isEphemeralResponse(response: unknown): boolean {
  const res = response as { flags?: number };
  // MessageFlags.Ephemeral = 64
  return (res.flags ?? 0) === 64;
}
