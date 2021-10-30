
// gets price range in terms of of token2/token1. To get token 1 in terms of token2 take 1/prices
function getPriceRangesFromTicks(lowTick: number, highTick: number, decimals1: number, decimals2: number): Array<number>{
    const rawPrice1 = 1.0001 ** lowTick;
    const rawPrice2 = 1.0001 ** highTick;
    const priceAdjusted1 = rawPrice1 **(decimals1 - decimals2);
    const priceAdjusted2 = rawPrice2 **(decimals1 - decimals2);

    const ret = Array<number>(priceAdjusted1, priceAdjusted2);
    return ret;
}
