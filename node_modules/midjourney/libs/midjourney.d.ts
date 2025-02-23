import { LoadingHandler, MJConfig, MJConfigParam } from "./interfaces";
import { MidjourneyApi } from "./midjourney.api";
import { MidjourneyMessage } from "./discord.message";
export declare class Midjourney extends MidjourneyMessage {
    config: MJConfig;
    private wsClient?;
    MJApi: MidjourneyApi;
    constructor(defaults: MJConfigParam);
    Connect(): Promise<this>;
    init(): Promise<this>;
    Imagine(prompt: string, loading?: LoadingHandler): Promise<import("./interfaces").MJMessage | null>;
    private getWsClient;
    Settings(): Promise<import("./interfaces").MJSettings | null>;
    Reset(): Promise<void>;
    Info(): Promise<import("./interfaces").MJInfo | null>;
    Fast(): Promise<null>;
    Relax(): Promise<null>;
    SwitchRemix(): Promise<string | null>;
    Describe(imgUri: string): Promise<import("./interfaces").MJDescribe | null>;
    DescribeByBlob(blob: Blob): Promise<import("./interfaces").MJDescribe | null>;
    Shorten(prompt: string): Promise<import("./interfaces").MJShorten | null>;
    Variation({ index, msgId, hash, content, flags, loading, }: {
        index: 1 | 2 | 3 | 4;
        msgId: string;
        hash: string;
        content?: string;
        flags: number;
        loading?: LoadingHandler;
    }): Promise<import("./interfaces").MJMessage | null>;
    Upscale({ index, msgId, hash, content, flags, loading, }: {
        index: 1 | 2 | 3 | 4;
        msgId: string;
        hash: string;
        content?: string;
        flags: number;
        loading?: LoadingHandler;
    }): Promise<import("./interfaces").MJMessage | null>;
    Custom({ msgId, customId, content, flags, loading, }: {
        msgId: string;
        customId: string;
        content?: string;
        flags: number;
        loading?: LoadingHandler;
    }): Promise<import("./interfaces").MJMessage | null>;
    ZoomOut({ level, msgId, hash, content, flags, loading, }: {
        level: "high" | "low" | "2x" | "1.5x";
        msgId: string;
        hash: string;
        content?: string;
        flags: number;
        loading?: LoadingHandler;
    }): Promise<import("./interfaces").MJMessage | null>;
    Reroll({ msgId, hash, content, flags, loading, }: {
        msgId: string;
        hash: string;
        content?: string;
        flags: number;
        loading?: LoadingHandler;
    }): Promise<import("./interfaces").MJMessage | null>;
    FaceSwap(target: string, source: string): Promise<import("./interfaces").MJDescribe | null>;
    Close(): void;
}
