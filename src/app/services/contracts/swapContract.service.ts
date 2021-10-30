import { Injectable } from '@angular/core';
import Web3 from "web3";
import { ERC20Token, Position, PriceRange, SwapInfo} from 'src/app/models/interfaces';
import { ERC20ABI, poolABI, NFTMinterABI, swapABI } from 'src/app/models/abi';

declare const window: any;

const SwapperContractAddress = "0xAB3aD342Be98eA316460431179aDB40A872749b2"; //Address of our custom smart contract
const NFTMinterAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"; //Hard coded address of Uniswap NFT Minter contract

@Injectable({
  providedIn: 'root'
})
export class SwapperContractService {
  window: any;
  swapperContract: any = null;
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
      this.getSwapperContract();
      return addresses.length ? addresses[0] : null;
  };

  public getSwapperContract = async () => {
    if (!this.account) {
      this.account = await this.openMetamask();
    }
    if (!this.swapperContract) {
      this.swapperContract = new window.web3.eth.Contract(
        swapABI,
        SwapperContractAddress,
      );
    }
  }

  public getNFTMinterContract = async () => {
    this.NFTMinterContract = new window.web3.eth.Contract(NFTMinterABI, NFTMinterAddress)
  }

  public isOwner = async () => {
    await this.getSwapperContract();
    let owner = await this.swapperContract.methods._owner().call();
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
    await this.getSwapperContract();
    try {
      const tokens = await this.swapperContract.methods.itemIdToTokenAddrs(tokenId).call();
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
    await this.getSwapperContract();
    await this.getNFTMinterContract();
    try {
      await this.NFTMinterContract.methods.approve(SwapperContractAddress, tokenId).send({from: this.account});
      return true
    } catch (e) {
      console.log("ERROR :: approveTransfer ::", e);
      return false
    }
  }

  public createNewSwap = async (tokenId: number, durationInSeconds: number) => {
    await this.getSwapperContract();
    try {
      await this.approveTransfer(tokenId);
      await this.swapperContract.methods.putUpNFTForSwap(
        tokenId, 
        durationInSeconds,
      ).send({from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: createNewSwap ::", e);
      return false;
    }
  }

  public deleteSwap = async (tokenId: number) => {
    await this.getSwapperContract();
    try {
      await this.swapperContract.methods.removeNFTForSwap(
        tokenId
      ).send({ from: this.account });
      return true;
    } catch (e) {
      console.log("ERROR :: deleteSwap::", e);
      return false;
    }
  }

  public makeSwapOffer = async (tokenIdOfExisting: number, tokenIdOfOffer: number) => {
    await this.getSwapperContract();
    try {
      await this.swapperContract.methods.offerSwap(
        tokenIdOfExisting,
        tokenIdOfOffer
      ).send({
        from: this.account,
      });
      return true;
    } catch (e) {
      console.log("ERROR :: makeSwapOffer ::", e);
      return false;
    }
  }

  public acceptSwapOffer = async (tokenIdOfExisting: number, tokenIdOfOffer: number) => {
    await this.getSwapperContract();
    try {
      await this.swapperContract.methods.acceptSwap(
        tokenIdOfExisting,
        tokenIdOfOffer
      ).send({
        from: this.account,
      });
      return true;
    } catch (e) {
      console.log("ERROR :: acceptSwapOffer ::", e);
      return false;
    }
  }

  //Protoco fee is the fee in percentages
  public calculateProtocolFees(tokenId: number, protocolFee: number) {
    const rentPrice = this.swapperContract.methods.itemIdToRentInfo(tokenId).price;
    return protocolFee * rentPrice;

  }

  public withdrawCash = async (tokenId: number) => {
    await this.getSwapperContract();
    try {
      await this.swapperContract.methods.withdrawFees(
        tokenId
      ).send({ from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: withdrawCash ::", e);
      return false;
    }
  }

  public returnSwapToOwner = async (tokenId: number) => {
    await this.getSwapperContract();
    try {
      await this.swapperContract.methods.returnNFTToOwner(
        tokenId
      ).send({ from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: returnSwapToOwner ::", e);
      return false;
    }
  }

  // public getAllListings = async () => {
  //   await this.getSwapperContract();
  //   try {
  //     const tokenIds: any[] = await this.swapperContract.methods.getAllItemIds().call();
  //     const allListings: SwapInfo[] = await Promise.all(tokenIds.map(this.getSwapListingById));
  //     return allListings
  //   } catch (e) {
  //     console.log("ERROR :: getAllListings ::", e);
  //     return []
  //   }
  // }

  // public getSwapListings = async () => {
  //   await this.getSwapperContract();
  //   try {
  //     const allListings: SwapInfo[] = await this.getAllListings();
  //     const availableListings: SwapInfo[] = allListings.filter(listing => listing.buyer == null)
  //     return availableListings
  //   } catch (e) {
  //     console.log("ERROR :: getSwapListings ::", e);
  //     return []
  //   }
  // }

  // public getSwapListingsByOwner = async (ownerAddress: string) => {
  //   await this.getSwapperContract();
  //   if (ownerAddress == "") {
  //     ownerAddress = this.account;
  //   }
  //   try {
  //     const allListings: SwapInfo[] = await this.getAllListings();
  //     const ownedListings: SwapInfo[] = allListings.filter(listing => listing.seller?.toLowerCase() == ownerAddress.toLowerCase())
  //     return ownedListings
  //   } catch (e) {
  //     console.log("ERROR :: getSwapListingsByOwner ::", e);
  //     return []
  //   }
  // }

  // public getSwapListingsByRenter = async (renterAddress: string) => {
  //   await this.getSwapperContract();
  //   if (renterAddress == "") {
  //     renterAddress = this.account;
  //   }
  //   try {
  //     const allListings: SwapInfo[] = await this.getAllListings();
  //     const rentedListings: SwapInfo[] = allListings.filter(listing => listing.buyer?.toLowerCase() == renterAddress.toLowerCase())
  //     return rentedListings
  //   } catch (e) {
  //     console.log("ERROR :: getSwapListingsByRenter ::", e);
  //     return []
  //   }
  // }

  // public getSwapListingById = async (tokenId: number) => {
  //   await this.getSwapperContract();
  //   try {
  //     const result = await this.swapperContract.methods.itemIdToSwapInfo(tokenId).call({ from: this.account });
  //     let makeSwapInfo = async (listing: any) => {
  //       let pairing: ERC20Token[] = await this.getPairing(listing.tokenId);
  //       let position: Position = await this.getPosition(listing.tokenId, pairing);
  //       return {
  //         tokenId: listing.tokenId,
  //         seller: listing.originalOwner,
  //         buyer: listing.renter == "0x0000000000000000000000000000000000000000" ? null : listing.renter,
  //         durationInSeconds: listing.duration,
  //         expiryDate: listing.expiryDate == 0 ? null : new Date(listing.expiryDate*1000),
  //         pairing: pairing,
  //         position: position
  //       } as SwapInfo
  //     }
  //     return await makeSwapInfo(result)
  //   } catch (e) {
  //     console.log("ERROR :: getSwapListingById ::", e);
  //     return {} as SwapInfo
  //   }
  // }

  public getNFTSVG = async (tokenId: number) => {
    await this.getNFTMinterContract();
    return await this.NFTMinterContract.methods.tokenURI(tokenId).call()
  }

  public restrictedWithdraw = async () => {
    await this.getSwapperContract();
    await this.swapperContract.methods.withdraw().send({ from: this.account });
    return true;
  }



}
