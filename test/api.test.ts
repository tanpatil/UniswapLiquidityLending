const graphAPI = require('../src/data_handling/api.ts').default;



describe('api', () => {

    const poolAddr = '0xcbcdf9626bc03e24f779434178a73a0b4bad62ed';
    const url = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3";
    const api = new graphAPI(url);


    describe('getLastXSwaps()', () => {
        it('should work as expected', async () => {
            const res = await api.getLastXSwaps(poolAddr, 1000);
            expect(res.length).toBe(1000);
        });
    });

    describe('getSwapsFromLastXDays()', () => {
        it('should work as expected', async () => {
            
            const res = await api.getSwapsFromLastXDays(poolAddr, 10, 1635471152);
            expect(res[res.length -1 ].timestamp >=1635471152 - 86400*1);
            
        });
    });

    describe(' getPoolInfo()', () => {
        it('should work as expected', async () => {
            
            const res = await api.getPoolInfo(poolAddr);
            console.log(res);
            
        });
    });

    describe('getFeeTierDistribution()', () => {
        it('should work as expected', async () => {
            
            const res = await api.getFeeTierDistribution('DAI','USDC');

            
        });
    });


    describe('getTickRangeInfo()', () => {
        it('should work as expected', async () => {
            

            
        });
    });









});


