const { Plugin } = require('powercord/entities')
const { getModule, getModuleByDisplayName, i18n: { Messages }, React } = require('powercord/webpack')
const { inject, uninject } = require('powercord/injector')
const { ContextMenu: { Button, ItemGroup, Slider } } = require('powercord/components')

module.exports = class CustomMute extends Plugin {
    async startPlugin() {
        const SubMenuItem = await getModuleByDisplayName('FluxContainer(SubMenuItem)')

        inject('cmguild', SubMenuItem.prototype, 'render', (_, res) => {
            if (res.props.label != Messages['MUTE_SERVER']) return res
            const { render } = res.props
            res.props.render = () => {
                const r = render()
                if (!r.props.guild) return r

                return [ r, this.customMuteGroup(r.props.guild.id) ]
            }

            return res
        })

        const ChannelTimedMuteGroup = await getModule(m => m.default && m.default.displayName == 'ChannelTimedMuteGroup')

        inject('cmchannel', ChannelTimedMuteGroup, 'default', (args, res) => {
            res.props.children = [ res.props.children,
                this.customMuteGroup(args[0].channel.guild_id, args[0].channel.id) ]

            return res
        })
        ChannelTimedMuteGroup.default.displayName = 'ChannelTimedMuteGroup'
    }

    pluginWillUnload() {
        uninject('cmguild')
        uninject('cmchannel')
    }

    customMuteGroup(gid, id) {
        let h = 0, m = 0
        return React.createElement(ItemGroup, { children: [
            React.createElement(Slider, { name: 'Hours', initialValue: 0, onValueChange: val => h = Math.round(val) }),
            React.createElement(Slider, { name: 'Minutes', initialValue: 0, onValueChange: val => m = Math.round(val) }),
            React.createElement(Button, { name: 'Apply',
                onClick: async () => {
                    if (!h && !m) return

                    const mod = await getModule(['updateNotificationSettings'])
                    if (id) return mod.updateChannelOverrideSettings(gid, id, this.getMuteConfig(h, m))
                    mod.updateNotificationSettings(gid, this.getMuteConfig(h, m))
                }
            })
        ]})
    }
    getMuteConfig(h, m) {
        const s = h * 3600 + m * 60
        return { muted: true, mute_config: {
            end_time: new Date(Date.now() + s * 1000).toISOString(), selected_time_window: s
        }}
    }
}
