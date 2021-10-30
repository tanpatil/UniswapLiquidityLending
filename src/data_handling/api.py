
import requests
import json


url = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3"


def getLastXSwaps(pool_addr, num_swaps):
  query = """
    query ($max_timestamp: String! $pool_addr: String!) {
      pool(id: $pool_addr){
        swaps(where:{timestamp_lt: $max_timestamp} first:1000 orderBy:timestamp orderDirection:desc){
          amount0
          amount1
          timestamp
          tick
        }
      }
    }
  """
  res, done, max_timestamp = [], False, "9999999999"
  total = 0
  while not done:
    variables = {"max_timestamp": max_timestamp, "pool_id": pool_id}
    r = requests.post(url, json={"query": query , "variables": variables})
    try: temp = json.loads(r.text)["data"]["pool"]["swaps"]
    except: print("ERROR", r.text)
    res.extend(temp)
    last_time_stamp = temp[-1]["timestamp"]
    total += len(temp)
    if total >= num_swaps or len(temp) < num_swaps
      done = True #Need at least 10k swaps or last 90 days of swaps
    else:
      max_timestamp = last_time_stamp
  return res




def getSwapsFromLastXDays(pool_addr,num_days, curr_time): #curr_time is current block time in epoch seconds
  query = """
    query ($max_timestamp: String! $pool_addr: String!) {
      pool(id: $pool_addr){
        swaps(where:{timestamp_lt: $max_timestamp} first:1000 orderBy:timestamp orderDirection:desc){
          amount0
          amount1
          timestamp
          tick
        }
      }
    }
  """
  res, done, max_timestamp = [], False, "9999999999"
  total = 0
  end_time_stamp = curr_time - (86400 * num_days) 
  end_time_stamp = 0 if end_time_stamp < 0
  while not done:
    variables = {"max_timestamp": max_timestamp, "pool_id": pool_id}
    r = requests.post(url, json={"query": query , "variables": variables})
    try: temp = json.loads(r.text)["data"]["pool"]["swaps"]
    except: print("ERROR", r.text)
    res.extend(temp)
    last_time_stamp = temp[-1]["timestamp"]
    total += len(temp)
    l
    if int(last_time_stamp) < c or len(temp) < 1000:
      done = True 
    else:
      max_timestamp = last_time_stamp
  return res


#get liqudiity by tick Index of pool
def getPoolData(pool_addr, skip):
    query = """
    allV3Ticks($pool_addr: String!, $skip: Int!) {
            ticks(first: 1000, skip: $skip, where: { poolAddress: $pool_addr }, orderBy: tickIdx) {
              tickIdx
              liquidityNet
              price0
              price1
            }
          }
        """
    variables = {"max_timestamp": max_timestamp, "pool_id": pool_id}
    r = requests.post(url, json={"query": query , "variables": variables})
    try: res = json.loads(r.text)["data"]["pool"]
    except: print("ERROR", r.text)
    return res


#Get fee tier distribution of total value locked of token0 and token1 
def getFeeTierDistribution(token_0, token_1):
    query = """
    feeTierDistribution($token0: String!, $token1: String!) {
            _meta {
              block {
                number
              }
            }
            asToken0: pools(
              orderBy: totalValueLockedToken0
              orderDirection: desc
              where: { token0: $token0, token1: $token1 }
            ) {
              feeTier
              totalValueLockedToken0
              totalValueLockedToken1
            }
            asToken1: pools(
              orderBy: totalValueLockedToken0
              orderDirection: desc
              where: { token0: $token1, token1: $token0 }
            ) {
              feeTier
              totalValueLockedToken0
              totalValueLockedToken1
            }
          }
    """
    variables = {"max_timestamp": max_timestamp, "pool_id": pool_id}
    r = requests.post(url, json={"query": query , "variables": variables})
    try: token0Data = json.loads(r.text)["data"]["token0"]
    except: print("ERROR", r.text)
    try: token1Data = json.loads(r.text)["data"]["token1"]
    except: print("ERROR", r.text)
    return token0Data, token1Data


def getTokenData():
  token_ids = [
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "0x6b175474e89094c44da98b954eedeac495271d0f",
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    "0x853d955acef822db058eb8505911ed77f175b99e",
    "0x8e870d67f660d95d5be530380d0ec0bd388289e1",
    "0x6123b0049f904d730db3c36a31167d9d4121fa6b",
    "0xb4efd85c19999d84251304bda99e90b92300bd93",
    "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce"
  ]
  url = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3"
  query = """
    query ($token_ids: [String]!) {
      tokens(where: {id_in: $token_ids}){
        symbol
        id
        decimals
        volume
        volumeUSD
        feesUSD
        derivedETH
      }
    }
  """
  variables = {"token_ids": token_ids}
  r = requests.post(url, json={"query": query , "variables": variables})
  try: res = json.loads(r.text)["data"]["tokens"]
  except: print("ERROR", r.text)
  return res