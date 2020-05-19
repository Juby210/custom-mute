const { Plugin } = require('powercord/entities')
const { findInReactTree } = require('powercord/util')
const { getAllModules, getModule, getModuleByDisplayName, React } = require('powercord/webpack')
const { inject, uninject } = require('powercord/injector')

module.exports = class CustomMute extends Plugin {
    injections = ['cmdm', 'cmgroup', 'cmguild']

    async startPlugin() {
        const DMUserContextMenu = await getModule(m => m.default && m.default.displayName == 'DMUserContextMenu')
        inject('cmdm', DMUserContextMenu, 'default', (args, res) => this.processChannelContextMenu(args[0].channel, res))
        DMUserContextMenu.default.displayName = 'DMUserContextMenu'

        const GroupDMContextMenu = await getModule(m => m.default && m.default.displayName == 'GroupDMContextMenu')
        inject('cmgroup', GroupDMContextMenu, 'default', (args, res) => this.processChannelContextMenu(args[0].channel, res))
        GroupDMContextMenu.default.displayName = 'GroupDMContextMenu'

        const channelComponents = await getAllModules(m => m.default && m.default.displayName == 'ChannelListTextChannelContextMenu')
        channelComponents.forEach((c, i) => {
            this.injections.push(`cmchannel${i}`)
            inject(`cmchannel${i}`, c, 'default', (args, res) => this.processChannelContextMenu(args[0].channel, res))
            c.default.displayName = 'ChannelListTextChannelContextMenu'
        })

        const GuildContextMenu = await getModule(m => m.default && m.default.displayName == 'GuildContextMenu')
        inject('cmguild', GuildContextMenu, 'default', (args, res) => {
            const submenu = findInReactTree(res, c => c.id == 'mute-guild')
            if (!submenu) return res
            submenu.children.push(this.customMuteGroup(args[0].guild.id))

            return res
        })
        GuildContextMenu.default.displayName = 'GuildContextMenu'
    }

    pluginWillUnload = () => this.injections.forEach(i => uninject(i))

    processChannelContextMenu(channel, res) {
        if (!channel) return res
        const submenu = findInReactTree(res, c => c.id == 'mute-channel')
        if (!submenu) return res
        submenu.children.push(this.customMuteGroup(channel.guild_id, channel.id))
        return res
    }

    customMuteGroup(gid, id, returnValues, mute) {
        const { slider: className } = getModule(['slider', 'sliderContainer'], false)
        const Menu = getModule(['MenuGroup', 'MenuItem'], false)
        const Slider = getModuleByDisplayName('Slider', false)

        let h = 0, m = 0
        return [
            React.createElement(Menu.MenuSeparator),
            React.createElement(Menu.MenuControlItem, {
                control: () => React.createElement(Slider, { className, mini: true, initialValue: 0, onValueChange: val => h = Math.round(val) }),
                label: 'Hours'
            }),
            React.createElement(Menu.MenuControlItem, {
                control: () => React.createElement(Slider, { className, mini: true, initialValue: 0, onValueChange: val => m = Math.round(val) }),
                label: 'Minutes'
            }),
            React.createElement(Menu.MenuItem, {
                action: () => {
                    if (!h && !m) return
                    if (returnValues && !mute) return returnValues(h, m)

                    const mod = getModule(['updateNotificationSettings'], false)
                    if (id) mod.updateChannelOverrideSettings(gid, id, this.getMuteConfig(h, m))
                    else mod.updateNotificationSettings(gid, this.getMuteConfig(h, m))
                    if (returnValues) return returnValues(h, m)
                },
                label: 'Apply'
            })
        ]
    }
    getMuteConfig(h, m) {
        const s = h * 3600 + m * 60
        return { muted: true, mute_config: {
            end_time: new Date(Date.now() + s * 1000).toISOString(), selected_time_window: s
        }}
    }
}
