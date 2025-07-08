import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { makeRange } from "@components/PluginSettings/components";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByCodeLazy } from "@webpack";
import { ChannelStore, GuildMemberStore, GuildRoleStore, GuildStore } from "@webpack/common";

const useMessageAuthor = findByCodeLazy('"Result cannot be null because the message is not null"');

const settings = definePluginSettings({
    chatMentions: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show role colors in chat mentions (including in the message box)",
        restartNeeded: true
    },
    memberList: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show role colors in member list role headers",
        restartNeeded: true
    },
    voiceUsers: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show role colors in the voice chat user list",
        restartNeeded: true
    },
    reactorsList: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show role colors in the reactors list",
        restartNeeded: true
    },
    pollResults: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show role colors in the poll results",
        restartNeeded: true
    },
    colorChatMessages: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Color chat messages based on the author's role color",
        restartNeeded: true,
    },
    messageSaturation: {
        type: OptionType.SLIDER,
        description: "Intensity of message coloring.",
        markers: makeRange(0, 100, 10),
        default: 30
    }
});

// Custom colors for DM users (pick any colors you like)
const DMUserColors = ['#ff4500', '#1e90ff', '#32cd32', '#ff69b4', '#ffa500'];

export default definePlugin({
    name: "RoleColorEverywhereDMOnly",
    authors: [Devs.KingFish, Devs.lewisakura, Devs.AutumnVN, Devs.Kyuuhachi, Devs.jamesbt365],
    description: "Shows role colors only in DMs, with custom colors for DM users",

    settings,

    patches: [
        // Your existing patches remain here, optionally guarded by new color logic if needed
        // For brevity, I'm leaving them out here, but you can keep them as is
    ],

    getColorString(userId: string, channelOrGuildId: string) {
        try {
            const channel = ChannelStore.getChannel(channelOrGuildId);
            const guildId = channel?.guild_id ?? GuildStore.getGuild(channelOrGuildId)?.id;

            if (guildId != null) {
                // In guild: skip role colors
                return null;
            }

            // In DM: assign a consistent color by userId hash from DMUserColors
            let hash = 0;
            for (let i = 0; i < userId.length; i++) {
                hash = userId.charCodeAt(i) + ((hash << 5) - hash);
                hash |= 0; // Convert to 32bit integer
            }
            const color = DMUserColors[Math.abs(hash) % DMUserColors.length];
            return color;

        } catch (e) {
            new Logger("RoleColorEverywhereDMOnly").error("Failed to get color string", e);
        }
        return null;
    },

    getColorInt(userId: string, channelOrGuildId: string) {
        const colorString = this.getColorString(userId, channelOrGuildId);
        return colorString && parseInt(colorString.slice(1), 16);
    },

    getColorStyle(userId: string, channelOrGuildId: string) {
        const colorString = this.getColorString(userId, channelOrGuildId);
        return colorString && { color: colorString };
    },

    useMessageColorsStyle(message: any) {
        try {
            const { messageSaturation } = settings.use(["messageSaturation"]);
            const author = useMessageAuthor(message);

            const colorString = this.getColorString(author?.id, message.channel_id);
            if (colorString != null && messageSaturation !== 0) {
                const value = `color-mix(in oklab, ${colorString} ${messageSaturation}%, var({DEFAULT}))`;

                return {
                    color: value.replace("{DEFAULT}", "--text-default"),
                    "--header-primary": value.replace("{DEFAULT}", "--header-primary"),
                    "--text-muted": value.replace("{DEFAULT}", "--text-muted")
                };
            }
        } catch (e) {
            new Logger("RoleColorEverywhereDMOnly").error("Failed to get message color", e);
        }

        return null;
    },

    RoleGroupColor: ErrorBoundary.wrap(({ id, count, title, guildId, label }: { id: string; count: number; title: string; guildId: string; label: string; }) => {
        // For member lists, role colors only apply in guilds, so skip if no guild or if you want to disable for non-DMs
        if (!guildId) return null;

        const role = GuildRoleStore.getRole(guildId, id);

        return (
            <span style={{
                color: role?.colorString,
                fontWeight: "unset",
                letterSpacing: ".05em"
            }}>
                {title ?? label} &mdash; {count}
            </span>
        );
    }, { noop: true })
});
