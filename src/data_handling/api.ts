import { execPath } from "process";

const axios = require('axios').default;

export const graphAPIURL = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3";
// export const graphAPIURL = "https://api.thegraph.com/subgraphs/name/mtahon/uniswap-v3-rinkeby";

export default class graphAPI {

  url: string;


  constructor(url: string) {
    this.url = url;
  }

  public async getPositionInfo(positionId: number) {
    const query = `
    query ($position_id: String!) {
      position(id: $position_id){
        pool{
          id
        }
        depositedToken0
        depositedToken1
        token0
        token1
        collectedFeesToken0
        collectedFeesToken1
        liquidity
        
      }
  
  
  
  
    }`
    const variables = { "position_id": positionId};
    const response =  await axios.post(this.url,{ "query": query, "variables":variables});
    try {            
      const resp = response.data.data;
      console.log("Pos", positionId, response)
      return resp;
    } catch (error) {
      console.log(response.data);
      throw(error);
    } 
  
  
  }

  public async getPoolDayDataFromLastXDays (poolAddress: string, numDays: number) {
    const query = `
    query ($pool_addr: String!, $num_days: Int!) {
      poolDayDatas(id: $pool_addr, first: $num_days) {
        id
        date
        liquidity
        sqrtPrice
        token0Price
        token1Price
        tick 
        feeGrowthGlobal0X128
        feeGrowthGlobal1X128
        tvlUSD
        volumeToken0
        volumeToken1
        volumeUSD
      }
    }
    `

    const variables =  {"pool_addr": poolAddress, "num_days": numDays };
    const response =  await axios.post(this.url,{ "query": query, "variables":variables});
    console.log("Pooldaydata", response)
    try {
      const poolDayData = response.data.data;
      return poolDayData;
    } catch (error) {
      console.log(response.data);
      throw(error);
  } 

  }


public async getLastXSwaps(poolAddress: string, numSwaps: number) {
  const query = `
  query ($max_timestamp: String! $pool_addr: String! $num_swaps: Int!) {
    pool(id: $pool_addr){
      swaps(where:{timestamp_lt: $max_timestamp} first:$num_swaps orderBy:timestamp orderDirection:desc){
        amount0
        amount1
        amountUSD
        timestamp
        tick
      }
    }
  }
  `;

  let res = Array<any>();
  let done = false;
  const max_timestamp = "9999999999";
  let total = 0;
  const variables = { "max_timestamp": max_timestamp, "pool_addr": poolAddress, "num_swaps": numSwaps };
  const response =  await axios.post(this.url,{ "query": query, "variables":variables});

    try {            
        const swaps = response.data.data.pool.swaps;
        res.push(...swaps);
        total += swaps.length;
        return res;
      } catch (error) {
        console.log(response.data);
        throw(error);
      }  
          
      

  }



  public async getSwapsFromLastXDays(poolAddress: string, numDays: number, currTime: number) {
    const query = `
    query ($min_timestamp: BigInt! $pool_addr: String!) {
      pool(id: $pool_addr){
        swaps(where:{timestamp_gte: $min_timestamp} orderBy:timestamp orderDirection:asc first:1000){
          amount0
          amount1
          amountUSD
          timestamp
          tick
        }
      }
    }
    `;

    let res = Array<any>();
    let min_timestamp =  BigInt(Math.floor(currTime - (86400 * numDays)));
    if (min_timestamp < 0) {
      min_timestamp = BigInt(0);
    }
    let done = false;
    
    while(!done) {
      const variables = { "min_timestamp": min_timestamp.toString().trim(), "pool_addr": poolAddress };
      const response =  await axios.post(this.url,{ "query": query, "variables":variables});  
      try {
        const swaps = response.data.data.pool.swaps;
        res.push(...swaps);
        min_timestamp = swaps[swaps.length - 1].timestamp;
        if (swaps.length < 1000) {
          done = true;
        }
        } catch (error) {
            console.log(response.data);
            throw(error);
      }


    }
     
            
        return res;
  }

public async getPoolInfo (poolAddress: string) {
  const query = `
  query ($pool_addr: String!) {
      pool(id: $pool_addr){
          token0 {
            name
          }
          token1{
            name
          }
          feeTier
          liquidity
          token0Price
          token1Price
          txCount
          totalValueLockedToken0
          totalValueLockedToken1
          totalValueLockedETH
          totalValueLockedUSD
          liquidityProviderCount
        
      }
    }
      `;
  const variables = { "pool_addr": poolAddress };
  const response =  await axios.post(this.url,{ "query": query, "variables":variables});
  try {
    const poolData = response.data.data.pool;
    return poolData;
  } catch (error) {
    console.log(response.data);
    throw(error);
}  

}


//Takes in token Addrs
public async getFeeTierDistribution(token0: string, token1: string) {
const query = `query($token0: String!, $token1: String!) {
  asToken0: pools(
    orderBy: totalValueLockedToken0
    orderDirection: desc
    token0: $token0
    token1: $token1
  ) {
    feeTier
    feesUSD
    totalValueLockedToken0
    totalValueLockedToken1
  }
  asToken1: pools(
    orderBy: totalValueLockedToken0
    orderDirection: desc
    token0: $token1
    token1: $token0
  ) {
    feeTier
    feesUSD
    totalValueLockedToken0
    totalValueLockedToken1
  }
}`;
const variables = { "token0": token0, "token1": token1};
const response =  await axios.post(this.url,{ "query": query, "variables":variables});
console.log(response)
  try {

    return response.data.data

  } catch (error) {
    console.log(response.data);
    throw(error);
}  
}


public async getTickRangeInfo(poolAddress: string, tickLower: number, tickHigher: number) {
const query = `query ($pool_addr: String!, $tickLower: BigInt!, $tickHigher: BigInt!) {
  pool(id: $pool_addr){
    ticks(where: { tickIdx_gte: $tickLower, tickIdx_lte: $tickHigher}){
    liquidityGross
    price0
    price1
    volumeToken0
    volumeToken1
    volumeUSD
    feesUSD
    collectedFeesUSD
    collectedFeesToken0
    collectedFeesToken1
    }
      
  }
}`;
const variables = { "pool_addr": poolAddress, "tickLower": tickLower, "tickHigher":tickHigher };
const response =  await axios.post(this.url,{ "query": query, "variables":variables});
try {
  const tickData = response.data.data.pool.ticks;
  return tickData;
} catch (error) {
  console.log(response.data);
  throw(error);
} 


}





}





