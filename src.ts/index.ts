
import { ethers } from "ethers";

const logger = new ethers.utils.Logger("multicall/0.0.1");

interface MulticallResponse {
    blockNumber: ethers.BigNumber;
    statuses: Array<ethers.BigNumber>;
    results: Array<ethers.utils.Result>;
};

export class Multicaller {
    readonly provider: ethers.providers.Provider;

    gasLimitPerCall: number;
    resultLimitPerCall: number;

    private _pendingRequests: Array<{
        address: string,
        data: string,
        commit: (error: null | Error, status: boolean, result: any) => void;
    }>

    constructor(provider: ethers.providers.Provider) {
        this.provider = provider;

        this.gasLimitPerCall = 60000;
        this.resultLimitPerCall = 1024;

        this._pendingRequests = [ ];
    }

    queue(address: string, fragment: string, values?: Array<any>): Promise<ethers.utils.Result> {
        return this._queue(address, fragment, (values || []), true);
    }

    queueResult(address: string, fragment: string, values?: Array<any>): Promise<ethers.utils.Result> {
        return this._queue(address, fragment, (values || []), false);
    }

    _queue(address: string, method: string, values: Array<any>, dereference: boolean): Promise<any> {
        if (values == null) { values = [ ]; }

        const fragment = ethers.utils.FunctionFragment.from(method);
        const iface = new ethers.utils.Interface([ fragment ]);

        return new Promise((resolve, reject) => {
            this._pendingRequests.push({
                address,
                data: iface.encodeFunctionData(fragment, values),
                commit: (error: null | Error, success: boolean, result: any) => {
                    if (error) {
                        reject(error);

                    } else if (success) {
                        let output = iface.decodeFunctionResult(fragment, result);
                        if (dereference && fragment.outputs && fragment.outputs.length === 1) {
                            output = output[0];
                        }
                        resolve(output);

                    } else {
                        const error = logger.makeError("call failed", ethers.utils.Logger.errors.CALL_EXCEPTION, {
                            something: "123"
                        });
                        reject(error);
                    }
                }
            });
        });
    }

    async flush(): Promise<number> {
        const gasLimit = this.gasLimitPerCall;
        const resultLimit = this.resultLimitPerCall;

        const pendingRequests = this._pendingRequests;
        this._pendingRequests = [ ];

        const multicall = new ethers.Contract("multicall.eth", [
            "function execute(uint, uint, address[], bytes[]) view returns (uint blockNumber, uint[] statuses, bytes[] results)"
        ], this.provider);

        const { blockNumber, statuses, results } = <MulticallResponse>(await multicall.execute(
            gasLimit,
            resultLimit,
            pendingRequests.map((r) => r.address),
            pendingRequests.map((r) => r.data),
        ));

        statuses.forEach((status, index) => {
            pendingRequests[index].commit(null, !status.isZero(), results[index]);
        });

        return blockNumber.toNumber();
    }
}

(async function() {
    const tester = new Multicaller(ethers.getDefaultProvider());

    const dai = await tester.provider.resolveName("dai.tokens.ethers.eth");
    const ricmoo = await tester.provider.resolveName("ricmoo.firefly.eth");

    const result = {
        decimals: tester.queue(dai, "decimals() view returns (uint8)"),
        name: tester.queue(dai, "name() view returns (string)"),
        balance: tester.queue(dai, "balanceOf(address) view returns (uint256)", [ ricmoo ]),
    };
    console.log(result);

    const blockNumber = await tester.flush();
    console.log(result);

    console.log("BlockNumber", blockNumber);
    console.log(result);
})();
