"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Command = exports.Commands = void 0;
const tslib_1 = require("tslib");
const async_1 = tslib_1.__importDefault(require("async"));
const utils_1 = require("./utils");
exports.Commands = [
    "ask",
    "blend",
    "describe",
    "fast",
    "help",
    "imagine",
    "info",
    "prefer",
    "private",
    "public",
    "relax",
    "settings",
    "show",
    "stealth",
    "shorten",
    "subscribe",
];
function getCommandName(name) {
    for (const command of exports.Commands) {
        if (command === name) {
            return command;
        }
    }
}
class Command {
    config;
    constructor(config) {
        this.config = config;
    }
    cache = {};
    async cacheCommand(name) {
        if (this.cache[name] !== undefined) {
            return this.cache[name];
        }
        const command = await this.getCommand(name);
        console.log("=========", { command });
        this.cache[name] = command;
        return command;
        this.allCommand();
        return this.cache[name];
    }
    async allCommand() {
        let serverId = this.config.ServerId;
        if (!serverId) {
            serverId = this.config.ChannelId;
        }
        const url = `${this.config.DiscordBaseUrl}/api/v9/guilds/${serverId}/application-command-index`;
        const response = await this.safeFetch(url, {
            headers: { authorization: this.config.SalaiToken },
        });
        const data = await response.json();
        if (data?.application_commands) {
            data.application_commands.forEach((command) => {
                const name = getCommandName(command.name);
                if (name) {
                    this.cache[name] = command;
                }
            });
        }
    }
    async getCommand(name) {
        let serverId = this.config.ServerId;
        if (!serverId) {
            serverId = this.config.ChannelId;
        }
        const url = `${this.config.DiscordBaseUrl}/api/v9/guilds/${serverId}/application-command-index`;
        const response = await this.safeFetch(url, {
            headers: { authorization: this.config.SalaiToken },
        });
        const data = await response.json();
        if (data?.application_commands?.[0]) {
            return data.application_commands[0];
        }
        throw new Error(`Failed to get application_commands for command ${name}`);
    }
    safeFetch(input, init) {
        const request = this.config.fetch.bind(this, input, init);
        return new Promise((resolve, reject) => {
            this.fetchQueue.push({
                request,
                callback: (res) => {
                    resolve(res);
                },
            }, (error, result) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(result);
                }
            });
        });
    }
    async processFetchRequest({ request, callback, }) {
        const res = await request();
        callback(res);
        await (0, utils_1.sleep)(1000 * 4);
    }
    fetchQueue = async_1.default.queue(this.processFetchRequest, 1);
    async imaginePayload(prompt, nonce) {
        const data = await this.commandData("imagine", [
            {
                type: 3,
                name: "prompt",
                value: prompt,
            },
        ]);
        return this.data2Paylod(data, nonce);
    }
    async PreferPayload(nonce) {
        const data = await this.commandData("prefer", [
            {
                type: 1,
                name: "remix",
                options: [],
            },
        ]);
        return this.data2Paylod(data, nonce);
    }
    async shortenPayload(prompt, nonce) {
        const data = await this.commandData("shorten", [
            {
                type: 3,
                name: "prompt",
                value: prompt,
            },
        ]);
        return this.data2Paylod(data, nonce);
    }
    async infoPayload(nonce) {
        const data = await this.commandData("info");
        return this.data2Paylod(data, nonce);
    }
    async fastPayload(nonce) {
        const data = await this.commandData("fast");
        return this.data2Paylod(data, nonce);
    }
    async relaxPayload(nonce) {
        const data = await this.commandData("relax");
        return this.data2Paylod(data, nonce);
    }
    async settingsPayload(nonce) {
        const data = await this.commandData("settings");
        return this.data2Paylod(data, nonce);
    }
    async describePayload(image, nonce) {
        const data = await this.commandData("describe", [
            {
                type: 11,
                name: "image",
                value: image.id,
            },
        ], [
            {
                id: image.id,
                filename: image.filename,
                uploaded_filename: image.upload_filename,
            },
        ]);
        return this.data2Paylod(data, nonce);
    }
    async commandData(name, options = [], attachments = []) {
        const command = await this.cacheCommand(name);
        const data = {
            version: command.version,
            id: command.id,
            name: command.name,
            type: command.type,
            options,
            application_command: command,
            attachments,
        };
        return data;
    }
    //TODO data type
    data2Paylod(data, nonce) {
        const payload = {
            type: 2,
            application_id: data.application_command.application_id,
            guild_id: this.config.ServerId,
            channel_id: this.config.ChannelId,
            session_id: this.config.SessionId,
            nonce,
            data,
        };
        return payload;
    }
}
exports.Command = Command;
//# sourceMappingURL=command.js.map