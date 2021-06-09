
import { ethers } from "ethers";

const logger = new ethers.utils.Logger("multicall/0.0.1");

// This provider cached ENS names, since if used they
// are probably highly related. This could also be done
// over the multicall contract
class HijackProvider extends ethers.providers.BaseProvider {
    private _ensCache: Record<string, Promise<string>>;
    private _provider: ethers.providers.Provider;

    constructor(provider: ethers.providers.Provider) {
        super(provider.getNetwork());

        this._provider = provider;
        this._ensCache = { };
    }

    async resolveName(name: string) {
        try {
            return ethers.utils.getAddress(name);
        } catch (e) { }

        if (!this._ensCache[name]) {
            console.log("Looking up", name);
            this._ensCache[name] = this._provider.resolveName(name).then((address) => {
                if (address == null) {
                    logger.throwError("ENS name not set", ethers.utils.Logger.errors.UNSUPPORTED_OPERATION, {
                        operation: "resolveName",
                        name
                    });
                }
                return address;
            });
        }

        return await this._ensCache[name];
    }
}

interface MulticallResponse {
    blockNumber: ethers.BigNumber;
    statuses: Array<ethers.BigNumber>;
    results: Array<ethers.utils.Result>;
};

export class Multicaller {
    readonly provider: ethers.providers.Provider;
    private _hijackProvider: ethers.providers.Provider;

    gasLimitPerCall: number;
    resultLimitPerCall: number;

    private _pendingRequests: Array<{
        address: string,
        getData: () => Promise<string>,
        commit: (error: null | Error, status: boolean, result: any) => void;
    }>

    constructor(provider: ethers.providers.Provider) {
        this.provider = provider;
        this._hijackProvider = new HijackProvider(provider);

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
        const contract = new ethers.Contract(ethers.constants.AddressZero, iface, this._hijackProvider);

        return new Promise((resolve, reject) => {
            this._pendingRequests.push({
                address,
                getData: () => {
                    return contract.populateTransaction[fragment.format()](...values).then((tx) => {
                        console.log(tx);
                        return tx.data || "0x";
                    });
                },
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

        const pending = this._pendingRequests;
        this._pendingRequests = [ ];

        const multicall = new ethers.Contract("multicall.eth", [
            "function execute(uint, uint, address[], bytes[]) view returns (uint blockNumber, uint[] statuses, bytes[] results)"
        ], this.provider);

        const { addresses, datas } = await ethers.utils.resolveProperties({
            addresses: Promise.all(pending.map((r) => this._hijackProvider.resolveName(r.address))),
            datas: Promise.all(pending.map((r) => r.getData()))
        });

        const { blockNumber, statuses, results } = <MulticallResponse>(await multicall.execute(
            gasLimit,
            resultLimit,
            addresses,
            datas
        ));

        statuses.forEach((status, index) => {
            pending[index].commit(null, !status.isZero(), results[index]);
        });

        return blockNumber.toNumber();
    }
}
(async function() {
    const tester = new Multicaller(ethers.getDefaultProvider());

    const dai = "dai.tokens.ethers.eth";
    const ricmoo = "ricmoo.firefly.eth";

    const result = {
        decimals: tester.queue(dai, "decimals() view returns (uint8)"),
        name: tester.queue(dai, "name() view returns (string)"),
        balance: tester.queue(dai, "balanceOf(address) view returns (uint256)", [ ricmoo ]),
    };
    const blockNumber = await tester.flush();
    console.log("BlockNumber", blockNumber);
    console.log(result);
})();
