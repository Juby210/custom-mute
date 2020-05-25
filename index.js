const { Plugin } = require('powercord/entities')
const { findInReactTree } = require('powercord/util')
const { getAllModules, getModule, getModuleByDisplayName, React } = require('powercord/webpack')
const { inject, uninject } = require('powercord/injector')

module.exports = class CustomMute extends Plugin {
    injections = ['cmguild', 'cminbox']

    async startPlugin() {
        const channelComponents = ['ChannelListTextChannelContextMenu', 'DMUserContextMenu', 'GroupDMContextMenu']
        channelComponents.forEach(async displayName => {
            (await getAllModules(m => m.default && m.default.displayName == displayName)).forEach((m, i) => {
                const inj = `cm-${displayName}-${i}`
                this.injections.push(inj)
                inject(inj, m, 'default', (args, res) => this.processChannelContextMenu(args[0].channel, res))
                m.default.displayName = displayName
            })
        })

        const GuildContextMenu = await getModule(m => m.default && m.default.displayName == 'GuildContextMenu')
        inject('cmguild', GuildContextMenu, 'default', (args, res) => this.processGuildContextMenu(args[0].guild, res))
        GuildContextMenu.default.displayName = 'GuildContextMenu'

        const RecentsNotificationSettingsContextMenu = await getModule(m => m.default && m.default.displayName == 'RecentsNotificationSettingsContextMenu')
        inject('cminbox', RecentsNotificationSettingsContextMenu, 'default', (args, res) => {
            res = this.processChannelContextMenu(args[0].channel, res)
            if (!args[0].channel.guild_id) return res
            return this.processGuildContextMenu({ id: args[0].channel.guild_id }, res)
        })
    }

    pluginWillUnload = () => this.injections.forEach(i => uninject(i))

    processChannelContextMenu(channel, res) {
        if (!channel) return res
        const submenu = findInReactTree(res, c => c.id == 'mute-channel')
        if (!submenu) return res
        submenu.children.push(this.customMuteGroup(channel.guild_id, channel.id))

        return res
    }
    processGuildContextMenu(guild, res) {
        if (!guild) return res
        const submenu = findInReactTree(res, c => c.id == 'mute-guild')
        if (!submenu) return res
        submenu.children.push(this.customMuteGroup(guild.id))

        return res
    }

    customMuteGroup(gid, id, returnValues, mute) {
        const c = getModule(['slider', 'sliderContainer'], false)
        const { MenuControlItem, MenuItem, MenuSeparator } = getModule(['MenuGroup', 'MenuItem'], false)
        const Slider = getModuleByDisplayName('Slider', false)

        let h = 0, m = 0
        return [
            React.createElement(MenuSeparator),
            React.createElement(MenuControlItem, {
                control: () => React.createElement('div', { className: c.sliderContainer },
                    React.createElement(Slider, { className: c.slider, mini: true, initialValue: 0, onValueChange: val => h = Math.round(val),
                        onValueRender: val => React.createElement('span', null, Math.round(val) + ' h') })
                ),
                id: 'cmhours',
                label: 'Hours'
            }),
            React.createElement(MenuControlItem, {
                control: () => React.createElement('div', { className: c.sliderContainer },
                    React.createElement(Slider, { className: c.slider, mini: true, initialValue: 0, onValueChange: val => m = Math.round(val),
                        onValueRender: val => React.createElement('span', null, `${Math.round(val)} min${Math.round(val) == 1 ? '' : 's'}`) })
                ),
                id: 'cmmin',
                label: 'Minutes'
            }),
            React.createElement(MenuItem, {
                action: () => {
                    if (!h && !m) return
                    if (returnValues && !mute) return returnValues(h, m)

                    const mod = getModule(['updateNotificationSettings'], false)
                    if (id) mod.updateChannelOverrideSettings(gid, id, this.getMuteConfig(h, m))
                    else mod.updateNotificationSettings(gid, this.getMuteConfig(h, m))
                    if (returnValues) return returnValues(h, m)
                },
                id: 'cmapply',
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
