const { Plugin } = require('powercord/entities')
const { getModule, i18n: { Messages }, React } = require('powercord/webpack')
const { inject, uninject } = require('powercord/injector')
const { ContextMenu: { Button, ItemGroup, Slider } } = require('powercord/components')

const getDefultByDisplayName = name => getModule(m => m.default && m.default.displayName == name, true, true)

module.exports = class CustomMute extends Plugin {
    async startPlugin() {
        const mod = await getModule(['updateNotificationSettings'])
        const ChannelTimedMuteGroup = await getDefultByDisplayName('ChannelTimedMuteGroup')

        inject('cmchannel', ChannelTimedMuteGroup, 'default', (args, res) => {
            let h = 0, m = 0
            res.props.children = [ res.props.children, React.createElement(ItemGroup, { children: [
                React.createElement(Slider, { name: 'Hours', initialValue: 0, onValueChange: val => h = Math.round(val) }),
                React.createElement(Slider, { name: 'Minutes', initialValue: 0, onValueChange: val => m = Math.round(val) }),
                React.createElement(Button, { name: 'Apply', onClick: () => {
                    if (!h && !m) return
                    mod.updateChannelOverrideSettings(args[0].channel.guild_id, args[0].channel.id, this.getMuteConfig(h, m))
                }})
            ]})]

            return res
        })
        ChannelTimedMuteGroup.default.displayName = 'ChannelTimedMuteGroup'

        const GuildContextMenu = await getDefultByDisplayName('GuildContextMenu')

        inject('cmguild', GuildContextMenu, 'default', (args, res) => {
            const muteGroup = res.props.children.find(({ props: { children: r } }) =>
                r && r.props && r.props.label == Messages['MUTE_SERVER'])
            if (!muteGroup) return res
            const { render } = muteGroup.props.children.props
            muteGroup.props.children.props.render = () => {
                let h = 0, m = 0
                return [ render(), React.createElement(ItemGroup, { children: [
                    React.createElement(Slider, { name: 'Hours', initialValue: 0, onValueChange: val => h = Math.round(val) }),
                    React.createElement(Slider, { name: 'Minutes', initialValue: 0, onValueChange: val => m = Math.round(val) }),
                    React.createElement(Button, { name: 'Apply', onClick: () => {
                        if (!h && !m) return
                        mod.updateNotificationSettings(args[0].guild.id, this.getMuteConfig(h, m))
                    }})
                ]})]
            }

            return res
        })
        GuildContextMenu.default.displayName = 'GuildContextMenu'
    }

    pluginWillUnload() {
        uninject('cmchannel')
        uninject('cmguild')
    }

    getMuteConfig(h, m) {
        const s = h * 3600 + m * 60
        return { muted: true, mute_config: {
            end_time: new Date(Date.now() + s * 1000).toISOString(), selected_time_window: s
        }}
    }
}
