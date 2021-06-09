import { ethers } from "ethers";
export declare class Multicaller {
    readonly provider: ethers.providers.Provider;
    gasLimitPerCall: number;
    resultLimitPerCall: number;
    private _pendingRequests;
    constructor(provider: ethers.providers.Provider);
    queue(address: string, fragment: string, values?: Array<any>): Promise<ethers.utils.Result>;
    queueResult(address: string, fragment: string, values?: Array<any>): Promise<ethers.utils.Result>;
    _queue(address: string, method: string, values: Array<any>, dereference: boolean): Promise<any>;
    flush(): Promise<number>;
}
