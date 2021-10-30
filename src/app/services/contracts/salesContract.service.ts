import { Injectable } from '@angular/core';
import Web3 from "web3";
import { ERC20Token, Position, PriceRange, ListingInfo, RentInfo } from 'src/app/models/interfaces';
import { ERC20ABI, salesABI, NFTMinterABI } from 'src/app/models/abi';
import graphAPI, { graphAPIURL } from 'src/data_handling/api';

declare const window: any;

//0x5FbDB2315678afecb367f032d93F642f64180aa3
const SalesContractAddress = "0x0F8528a14e2417EeEcccb298Df3f8BBA8b3F1B4d"; //Address of our custom smart contract
const NFTMinterAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"; //Hard coded address of Uniswap NFT Minter contract

@Injectable({
  providedIn: 'root'
})
export class SalesContractService {
  window: any;
  salesContract: any = null;
  NFTMinterContract: any = null;
  account: any = null;
  graphAPI: any;

  constructor() {
    let setup = async () => {
      this.account = await this.openMetamask();
    }
    setup();
    this.graphAPI = new graphAPI(graphAPIURL);
  }
  private getAccounts = async () => {
      try {
          return await window.ethereum.request({ method: 'eth_accounts' });
      } catch (e) {
        console.log("ERROR :: getAccounts ::", e)
        return [];
      }
  }

  public openMetamask = async () => {
      window.web3 = new Web3(window.ethereum);
      let addresses = await this.getAccounts();
      if (!addresses.length) {
          try {
            addresses = await window.ethereum.enable();
          } catch (e) {
            console.log("ERROR :: openMetamask ::", e)
            return false;
          }
      }
      this.getSalesContract();
      return addresses.length ? addresses[0] : null;
  };

  public getSalesContract = async () => {
    if (!this.account) {
      this.account = await this.openMetamask();
    }
    if (!this.salesContract) {
      this.salesContract = new window.web3.eth.Contract(
        salesABI,
        SalesContractAddress,
      );
    }
  }

  public getNFTMinterContract = async () => {
    this.NFTMinterContract = new window.web3.eth.Contract(NFTMinterABI, NFTMinterAddress)
  }

  public isOwner = async () => {
    await this.getSalesContract();
    let owner = await this.salesContract.methods._owner().call();
    return owner.toLowerCase() == this.account.toLowerCase();
  }

  public getERC20TokenInfoFromAddress = async (tokenAddress: string) => {
    console.log(tokenAddress)
    const tokenContract = new window.web3.eth.Contract(ERC20ABI, tokenAddress);
    const symbol = await tokenContract.methods.symbol().call();
    const decimals = await tokenContract.methods.decimals().call();
    const name = await tokenContract.methods.name().call();
    return { address: tokenAddress, symbol: symbol, name: name, decimals: decimals } as ERC20Token; 
  }

  public getPairing = async (tokenId: number) => {
    await this.getSalesContract();
    try {
      const tokens = await this.salesContract.methods.itemIdToTokenAddrs(tokenId).call();
      console.log(tokens)
      const tokenInfo: ERC20Token[] = [await this.getERC20TokenInfoFromAddress(tokens.token0Addr), await this.getERC20TokenInfoFromAddress(tokens.token1Addr)]
      return tokenInfo;
    } catch (e) {
      console.log("ERROR :: getPairing ::", e);
      return []
    }
  }

  public getPosition = async (tokenId: number, pairing: ERC20Token[]) => {
    await this.getNFTMinterContract();
    try {
      const position = await this.NFTMinterContract.methods.positions(tokenId).call();
      const graphPos = await this.graphAPI.getPositionInfo(tokenId);
      let pricesInTermsOfToken2 = this.getPriceRangesFromTicks(position.tickLower, position.tickUpper, pairing[0].decimals, pairing[1].decimals);
      return {
        tickUpper: position.tickUpper,
        tickLower: position.tickLower,
        liquidity: position.liquidity,
        fee: position.fee / 10000,
        feeGrowth: [position.feeGrowthInside0LastX128, position.feeGrowthInside1LastX128],
        tokensOwed: [position.tokensOwed0, position.tokensOwed1],
        tokensDeposited: [parseFloat(graphPos.position.depositedToken0), parseFloat(graphPos.position.depositedToken1)],
        pool: graphPos.position.pool.id,
        priceRange: [
          {lower: 1/pricesInTermsOfToken2[1], upper: 1/pricesInTermsOfToken2[0]} as PriceRange, 
          {lower: pricesInTermsOfToken2[0], upper: pricesInTermsOfToken2[1]} as PriceRange],
        rangeToShow: pricesInTermsOfToken2[0] > 1/pricesInTermsOfToken2[1] ? 1 : 0
      } as Position
    } catch (e) {
      console.log("ERROR :: getPosition ::", e);
      return {} as Position
    }
  }

  public getPriceRangesFromTicks = (lowTick: number, highTick: number, decimals1: number, decimals2: number): Array<number> => {
    const rawPrice1 = 1.0001 ** lowTick;
    const rawPrice2 = 1.0001 ** highTick;
    const priceAdjusted1 = rawPrice1 * 10**(decimals1 - decimals2);
    const priceAdjusted2 = rawPrice2 * 10**(decimals1 - decimals2);
    const ret = Array<number>(priceAdjusted1, priceAdjusted2);
    return ret;
}


  public approveTransfer = async (tokenId: number) => {
    await this.getSalesContract();
    await this.getNFTMinterContract();
    try {
      await this.NFTMinterContract.methods.approve(SalesContractAddress, tokenId).send({from: this.account});
      return true
    } catch (e) {
      console.log("ERROR :: approveTransfer ::", e);
      return false
    }
  }

  public createNewSellOffer = async (tokenId: number, priceInEther: number) => {
    await this.getSalesContract();
    try {
      console.log(this.salesContract)
      await this.approveTransfer(tokenId);
      await this.salesContract.methods.putUpNFTForSale(
        tokenId, 
        window.web3.utils.toWei(priceInEther.toString(), 'ether'),
      ).send({from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: createNewSellOffer ::", e);
      return false;
    }
  }

  public deleteSale = async (tokenId: number) => {
    await this.getSalesContract();
    try {
      await this.salesContract.methods.removeNFTForSale(
        tokenId
      ).send({ from: this.account });
      return true;
    } catch (e) {
      console.log("ERROR :: deleteSale ::", e);
      return false;
    }
  }

  public buy = async (tokenId: number, priceInEther: number) => {
    await this.getSalesContract();
    try {
      await this.salesContract.methods.buyNFT(
        tokenId
      ).send({
        from: this.account,
        value: window.web3.utils.toWei(priceInEther.toString(), 'ether')
      });
      return true;
    } catch (e) {
      console.log("ERROR :: buy ::", e);
      return false;
    }
  }

  //Protoco fee is the fee in percentages
  public calculateProtocolFees(tokenId: number, protocolFee: number) {
    const salesPrice = this.salesContract.methods.itemIdToListingInfo(tokenId).price;
    return protocolFee * salesPrice;

  }

  public withdrawCash = async (tokenId: number) => {
    await this.getSalesContract();
    try {
      await this.salesContract.methods.withdrawFees(
        tokenId
      ).send({ from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: withdrawCash ::", e);
      return false;
    }
  }

  public returnSaleToOwner = async (tokenId: number) => {
    await this.getSalesContract();
    try {
      await this.salesContract.methods.returnNFTToOwner(
        tokenId
      ).send({ from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: returnSaleToOwner ::", e);
      return false;
    }
  }

  public getAllListings = async () => {
    await this.getSalesContract();
    try {
      const tokenIds: any[] = await this.salesContract.methods.getAllItemIds().call();
      const allListings: RentInfo[] = await Promise.all(tokenIds.map(this.getSalesListingById));
      console.log("Sale:",allListings)
      return allListings
    } catch (e) {
      console.log("ERROR :: getAllListings ::", e);
      return []
    }
  }


  public getSalesListingsByOwner = async (ownerAddress: string) => {
    await this.getSalesContract();
    if (ownerAddress == "") {
      ownerAddress = this.account;
    }
    try {
      const allListings: RentInfo[] = await this.getAllListings();
      const ownedListings: RentInfo[] = allListings.filter(listing => listing.seller?.toLowerCase() == ownerAddress.toLowerCase())
      return ownedListings
    } catch (e) {
      console.log("ERROR :: getSalesListingsByOwner ::", e);
      return []
    }
  }


  public getSalesListingById = async (tokenId: number) => {
    await this.getSalesContract();
    try {
      const result = await this.salesContract.methods.itemIdToSaleInfo(tokenId).call({ from: this.account });
      console.log(tokenId, result)
      let makeSalesInfo = async (listing: any) => {
        let pairing: ERC20Token[] = await this.getPairing(listing.tokenId);
        let position: Position = await this.getPosition(listing.tokenId, pairing);
        return {
          tokenId: listing.tokenId,
          seller: listing.originalOwner,
          priceInEther: window.web3.utils.fromWei(listing.price, 'ether'),
          pairing: pairing,
          position: position,
          durationInSeconds: -1,
          expiryDate: null
        } as RentInfo
      }
      return await makeSalesInfo(result)
    } catch (e) {
      console.log("ERROR :: getSalesListingById ::", e);
      return {} as RentInfo
    }
  }

  public getNFTSVG = async (tokenId: number) => {
    await this.getNFTMinterContract();
    return await this.NFTMinterContract.methods.tokenURI(tokenId).call()
  }

  public restrictedWithdraw = async () => {
    await this.getSalesContract();
    await this.salesContract.methods.withdraw().send({ from: this.account });
    return true;
  }



}
