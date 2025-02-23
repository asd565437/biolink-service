export declare class faceSwap {
    hf_token?: string;
    constructor(hf_token?: string);
    changeFace(Target: Blob, Source: Blob): Promise<any>;
}
