import { Injectable } from '@angular/core';
const CoinGecko = require('coingecko-api');

@Injectable({
  providedIn: 'root'
})
export class CoingeckoService {
  client;

  constructor() {
    this.client = new CoinGecko();
  }

  getEthPrice = async () => {
    return (await this.client.simple.price({ ids: ['ethereum'], vs_currencies: ['usd']})).data.ethereum.usd
  }

  getPrice = async (coinName: string) => {
    // See: https://www.coingecko.com/en/api/documentation for valid coinNames
    return await this.client.simple.price({ ids: [coinName], vs_currencies: ['usd']})
  }

  getList = async () => {
    return await this.client.coins.list();
  }
}