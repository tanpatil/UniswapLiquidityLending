import { Injectable } from '@angular/core';
import Web3 from "web3";
import { ERC20Token, Position, PriceRange, AuctionInfo } from 'src/app/models/interfaces';
import { ERC20ABI, auctionABI, NFTMinterABI } from 'src/app/models/abi';

declare const window: any;

const AuctionContractAddress = "0x7873dED9A53f8e41C56A0B7DEf5b6Cc1D8F7C0B7"; //Address of our custom smart contract
const NFTMinterAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"; //Hard coded address of Uniswap NFT Minter contract

@Injectable({
  providedIn: 'root'
})
export class AuctionContractService {
  window: any;
  auctionContract: any = null;
  NFTMinterContract: any = null;
  account: any = null;

  constructor() {
    let setup = async () => {
      this.account = await this.openMetamask();

    }
    setup();
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
      this.getAuctionContract();
      return addresses.length ? addresses[0] : null;
  };

  public getAuctionContract = async () => {
    if (!this.account) {
      this.account = await this.openMetamask();
    }
    if (!this.auctionContract) {
      this.auctionContract = new window.web3.eth.Contract(
        auctionABI,
        AuctionContractAddress,
      );
    }
  }

  public getNFTMinterContract = async () => {
    this.NFTMinterContract = new window.web3.eth.Contract(NFTMinterABI, NFTMinterAddress)
  }

  public isOwner = async () => {
    await this.getAuctionContract();
    let owner = await this.auctionContract.methods._owner().call();
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
    await this.getAuctionContract();
    try {
      const tokens = await this.auctionContract.methods.itemIdToTokenAddrs(tokenId).call();
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
      let pricesInTermsOfToken2 = this.getPriceRangesFromTicks(position.tickLower, position.tickUpper, pairing[0].decimals, pairing[1].decimals);
      return {
        tickUpper: position.tickUpper,
        tickLower: position.tickLower,
        liquidity: position.liquidity,
        fee: position.fee / 10000,
        feeGrowth: [position.feeGrowthInside0LastX128, position.feeGrowthInside1LastX128],
        tokensOwed: [position.tokensOwed0, position.tokensOwed1],
        priceRange: [
          {lower: 1/pricesInTermsOfToken2[0], upper: 1/pricesInTermsOfToken2[1]} as PriceRange, 
          {lower: pricesInTermsOfToken2[0], upper: pricesInTermsOfToken2[1]} as PriceRange]
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
    await this.getAuctionContract();
    await this.getNFTMinterContract();
    try {
      await this.NFTMinterContract.methods.approve(AuctionContractAddress, tokenId).send({from: this.account});
      return true
    } catch (e) {
      console.log("ERROR :: approveTransfer ::", e);
      return false
    }
  }

  public createNewAuction = async (tokenId: number, minBidInEther: number, duration: number, ) => {
    await this.getAuctionContract();
    try {
      await this.approveTransfer(tokenId);
      await this.auctionContract.methods.putUpNFTForAuction(
        tokenId, 
        window.web3.utils.toWei(minBidInEther.toString(), 'ether'),
        duration,
      ).send({from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: createNewAuction ::", e);
      return false;
    }
  }

  public deleteAuction = async (tokenId: number) => {
    await this.getAuctionContract();
    try {
      await this.auctionContract.methods.removeNFTForAuction(
        tokenId
      ).send({ from: this.account });
      return true;
    } catch (e) {
      console.log("ERROR :: deleteAuction ::", e);
      return false;
    }
  }

  public bid = async (tokenId: number, bidInEther: number) => {
    await this.getAuctionContract();
    try {
      // console.log(this.auctionContract.methods.itemIdToAuctionInfo(tokenId).toString());
      console.log(this.account);
      console.log(bidInEther);
        
      await this.auctionContract.methods.bidOnNFT(
        tokenId
      ).send({
        from: this.account,
        value: window.web3.utils.toWei(bidInEther.toString(), 'ether')
      });
      console.log(this.auctionContract.methods.itemIdToTokenAddrs[tokenId])
      return true;
      
    } catch (e) {
      console.log("ERROR :: bid ::", e);
      return false;
    }
  }

  public sendPositionToHighestBidder = async (tokenId: number) => {
    await this.getAuctionContract();
    try {
      // console.log(this.auctionContract.methods.itemIdToAuctionInfo(tokenId).toString());
      // await this.approveTransfer(tokenId);
      await this.auctionContract.methods.sendNFTToHighestBidder(
        tokenId
      ).send({
        from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: sendPositionToHighestBidder ::", e);
      return false;
    }
  }

  //Protoco fee is the fee in percentages
  public calculateProtocolFees(tokenId: number, protocolFee: number) {
    const salesPrice = this.auctionContract.methods.itemIdToListingInfo(tokenId).price;
    return protocolFee * salesPrice;

  }

  public withdrawCash = async (tokenId: number) => {
    await this.getAuctionContract();
    try {
      await this.auctionContract.methods.withdrawFees(
        tokenId
      ).send({ from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: withdrawCash ::", e);
      return false;
    }
  }

  public returnAssetToOwner = async (tokenId: number) => {
    await this.getAuctionContract();
    try {
      await this.auctionContract.methods.returnNFTToOwner(
        tokenId
      ).send({ from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: returnAssetToOwner ::", e);
      return false;
    }
  }

  public getAllListings = async () => {
    await this.getAuctionContract();
    try {
      const tokenIds: any[] = await this.auctionContract.methods.getAllItemIds().call();
      const allListings: AuctionInfo[] = await Promise.all(tokenIds.map(this.getAuctionListingById));
      return allListings
    } catch (e) {
      console.log("ERROR :: getAllListings ::", e);
      return []
    }
  }


  public getAuctionListingsByOwner = async (ownerAddress: string) => {
    await this.getAuctionContract();
    if (ownerAddress == "") {
      ownerAddress = this.account;
    }
    try {
      const allListings: AuctionInfo[] = await this.getAllListings();
      const ownedListings: AuctionInfo[] = allListings.filter(listing => listing.seller?.toLowerCase() == ownerAddress.toLowerCase())
      return ownedListings
    } catch (e) {
      console.log("ERROR :: getAuctionListingsByOwner ::", e);
      return []
    }
  }


  public getAuctionListingById = async (tokenId: number) => {
    await this.getAuctionContract();
    try {
      const result = await this.auctionContract.methods.itemIdToAuctionInfo(tokenId).call({ from: this.account });
      let makeAuctionInfo = async (listing: any) => {
        let pairing: ERC20Token[] = await this.getPairing(listing.tokenId);
        let position: Position = await this.getPosition(listing.tokenId, pairing);
        return {
          tokenId: listing.tokenId,
          seller: listing.originalOwner,
          minBid: window.web3.utils.fromWei(listing.minBidInEther, 'ether'),
          pairing: pairing,
          position: position,
          highestBidder: listing.highestBidder,
          expiryDate: listing.expiryDate,
          durationInSeconds: listing.duration
        } as AuctionInfo
      }
      return await makeAuctionInfo(result)
    } catch (e) {
      console.log("ERROR :: getSalesListingById ::", e);
      return {} as AuctionInfo
    }
  }

  public getNFTSVG = async (tokenId: number) => {
    await this.getNFTMinterContract();
    return await this.NFTMinterContract.methods.tokenURI(tokenId).call()
  }

  public restrictedWithdraw = async () => {
    await this.getAuctionContract();
    await this.auctionContract.methods.withdraw().send({ from: this.account });
    return true;
  }



}
