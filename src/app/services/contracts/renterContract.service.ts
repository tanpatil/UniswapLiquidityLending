import { Injectable } from '@angular/core';
import Web3 from "web3";
import { ERC20Token, Position, PriceRange, RentInfo } from 'src/app/models/interfaces';
import { ERC20ABI, poolABI, NFTMinterABI, rentABI } from 'src/app/models/abi';
import graphAPI, { graphAPIURL } from 'src/data_handling/api';

declare const window: any;

const RenterContractAddress = "0xC1a7CFb1e1D5eBD1881ef18Dc7a01cfD638DbD7e"; //Address of our custom smart contract
const NFTMinterAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"; //Hard coded address of Uniswap NFT Minter contract

@Injectable({
  providedIn: 'root'
})
export class RenterContractService {
  window: any;
  renterContract: any = null;
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
      this.getRenterContract();
      return addresses.length ? addresses[0] : null;
  };

  public getRenterContract = async () => {
    if (!this.account) {
      this.account = await this.openMetamask();
    }
    if (!this.renterContract) {
      this.renterContract = new window.web3.eth.Contract(
        rentABI,
        RenterContractAddress,
      );
    }
  }

  public getNFTMinterContract = async () => {
    this.NFTMinterContract = new window.web3.eth.Contract(NFTMinterABI, NFTMinterAddress)
  }

  public isOwner = async () => {
    await this.getRenterContract();
    let owner = await this.renterContract.methods._owner().call();
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
    await this.getRenterContract();
    try {
      const tokens = await this.renterContract.methods.itemIdToTokenAddrs(tokenId).call();
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
    await this.getRenterContract();
    await this.getNFTMinterContract();
    try {
      await this.NFTMinterContract.methods.approve(RenterContractAddress, tokenId).send({from: this.account});
      return true
    } catch (e) {
      console.log("ERROR :: approveTransfer ::", e);
      return false
    }
  }

  public createNewRental = async (tokenId: number, priceInEther: number, durationInSeconds: number) => {
    await this.getRenterContract();
    try {
      await this.approveTransfer(tokenId);
      await this.renterContract.methods.putUpNFTForRent(
        tokenId, 
        window.web3.utils.toWei(priceInEther.toString(), 'ether'),
        durationInSeconds,
      ).send({from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: createNewRental ::", e);
      return false;
    }
  }

  public deleteRental = async (tokenId: number) => {
    await this.getRenterContract();
    try {
      await this.renterContract.methods.removeNFTForRent(
        tokenId
      ).send({ from: this.account });
      return true;
    } catch (e) {
      console.log("ERROR :: deleteRental ::", e);
      return false;
    }
  }

  public rent = async (tokenId: number, priceInEther: number) => {
    await this.getRenterContract();
    try {
      await this.renterContract.methods.rentNFT(
        tokenId
      ).send({
        from: this.account,
        value: window.web3.utils.toWei(priceInEther.toString(), 'ether')
      });
      return true;
    } catch (e) {
      console.log("ERROR :: rent ::", e);
      return false;
    }
  }

  //Protoco fee is the fee in percentages
  public calculateProtocolFees(tokenId: number, protocolFee: number) {
    const rentPrice = this.renterContract.methods.itemIdToRentInfo(tokenId).price;
    return protocolFee * rentPrice;

  }

  public withdrawCash = async (tokenId: number) => {
    await this.getRenterContract();
    try {
      await this.renterContract.methods.withdrawFees(
        tokenId
      ).send({ from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: withdrawCash ::", e);
      return false;
    }
  }

  public returnRentalToOwner = async (tokenId: number) => {
    await this.getRenterContract();
    try {
      await this.renterContract.methods.returnNFTToOwner(
        tokenId
      ).send({ from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: returnRentalToOwner ::", e);
      return false;
    }
  }

  public getAllListings = async () => {
    await this.getRenterContract();
    try {
      const tokenIds: any[] = await this.renterContract.methods.getAllItemIds().call();
      const allListings: RentInfo[] = await Promise.all(tokenIds.map(this.getRentalListingById));
      return allListings
    } catch (e) {
      console.log("ERROR :: getAllListings ::", e);
      return []
    }
  }

  public getRentalListings = async () => {
    await this.getRenterContract();
    try {
      const allListings: RentInfo[] = await this.getAllListings();
      const availableListings: RentInfo[] = allListings.filter(listing => listing.buyer == null)
      return availableListings
    } catch (e) {
      console.log("ERROR :: getRentalListings ::", e);
      return []
    }
  }

  public getRentalListingsByOwner = async (ownerAddress: string) => {
    await this.getRenterContract();
    if (ownerAddress == "") {
      ownerAddress = this.account;
    }
    try {
      const allListings: RentInfo[] = await this.getAllListings();
      const ownedListings: RentInfo[] = allListings.filter(listing => listing.seller?.toLowerCase() == ownerAddress.toLowerCase())
      return ownedListings
    } catch (e) {
      console.log("ERROR :: getRentalListingsByOwner ::", e);
      return []
    }
  }

  public getRentalListingsByRenter = async (renterAddress: string) => {
    await this.getRenterContract();
    if (renterAddress == "") {
      renterAddress = this.account;
    }
    try {
      const allListings: RentInfo[] = await this.getAllListings();
      const rentedListings: RentInfo[] = allListings.filter(listing => listing.buyer?.toLowerCase() == renterAddress.toLowerCase())
      return rentedListings
    } catch (e) {
      console.log("ERROR :: getRentalListingsByRenter ::", e);
      return []
    }
  }

  public getRentalListingById = async (tokenId: number) => {
    await this.getRenterContract();
    try {
      const result = await this.renterContract.methods.itemIdToRentInfo(tokenId).call({ from: this.account });
      let makeRentInfo = async (listing: any) => {
        let pairing: ERC20Token[] = await this.getPairing(listing.tokenId);
        let position: Position = await this.getPosition(listing.tokenId, pairing);
        return {
          tokenId: listing.tokenId,
          seller: listing.originalOwner,
          buyer: listing.renter == "0x0000000000000000000000000000000000000000" ? null : listing.renter,
          priceInEther: window.web3.utils.fromWei(listing.price, 'ether'),
          durationInSeconds: listing.duration,
          expiryDate: listing.expiryDate == 0 ? null : new Date(listing.expiryDate*1000),
          pairing: pairing,
          position: position
        } as RentInfo
      }
      return await makeRentInfo(result)
    } catch (e) {
      console.log("ERROR :: getRentalListingById ::", e);
      return {} as RentInfo
    }
  }

  public getNFTSVG = async (tokenId: number) => {
    await this.getNFTMinterContract();
    return await this.NFTMinterContract.methods.tokenURI(tokenId).call()
  }

  public restrictedWithdraw = async () => {
    await this.getRenterContract();
    await this.renterContract.methods.withdraw().send({ from: this.account });
    return true;
  }



}
