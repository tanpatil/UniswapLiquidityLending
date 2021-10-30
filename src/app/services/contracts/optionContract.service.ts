import { Injectable } from '@angular/core';
import Web3 from "web3";
import { ERC20Token, Position, PriceRange, OptionInfo } from 'src/app/models/interfaces';
import { ERC20ABI, NFTMinterABI, optionABI } from 'src/app/models/abi';
import { async } from '@angular/core/testing';

declare const window: any;

const OptionContractAddress = "0x99b2C122defe27780cDA8c921c4C55d9280F3e86"; //Address of our custom smart contract
const NFTMinterAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"; //Hard coded address of Uniswap NFT Minter contract

@Injectable({
  providedIn: 'root'
})
export class OptionContractService {
  window: any;
  optionContract: any = null;
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
      this.getOptionContract();
      return addresses.length ? addresses[0] : null;
  };

  public getOptionContract = async () => {
    if (!this.account) {
      this.account = await this.openMetamask();
    }
    if (!this.optionContract) {
      this.optionContract = new window.web3.eth.Contract(
        optionABI,
        OptionContractAddress,
      );
    }
  }

  public getERC20Contract = async (tokenAddress: string) => {
      return  new window.web3.eth.Contract(ERC20ABI, tokenAddress);

  }

  public getNFTMinterContract = async () => {
    this.NFTMinterContract = new window.web3.eth.Contract(NFTMinterABI, NFTMinterAddress)
  }

  public isOwner = async () => {
    await this.getOptionContract();
    let owner = await this.optionContract.methods._owner().call();
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
    await this.getOptionContract();
    try {
      const tokens = await this.optionContract.methods.itemIdToTokenAddrs(tokenId).call();
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

public approveERC20Transfer = async (tokenAddr: string, amount: number) => {
    await this.getOptionContract();
    await this.getNFTMinterContract();
    try {
       const contract =  await this.getERC20Contract(tokenAddr);
       if (await !contract.approve(OptionContractAddress,amount)) {
           throw new Error("Could not approve control for ERC20 tokens");
       }
    } catch (e) {
        console.log("ERROR :: approveERC20Transfer ::", e);
        return false
    }
    return true;
}


  public approveNFTTransfer = async (tokenId: number) => {
    await this.getOptionContract();
    await this.getNFTMinterContract();
    try {
        if (await !this.NFTMinterContract.methods.approve(OptionContractAddress, tokenId).send({from: this.account})) {
            throw new Error("Could not approve control for NFT");
        }
    } catch (e) {
      console.log("ERROR :: approveNFTTransfer ::", e);
      return false
    }
    return true;
  }

  public createNewLongOption = async (tokenId: number, priceInEther: number, tokenToLong: string, durationInSeconds: number, percentage: number) => {
    //percentage is in (0, 100]
    await this.getOptionContract();
    try {
      await this.approveNFTTransfer(tokenId);
      await this.optionContract.methods.createLongOption(
        tokenId, 
        window.web3.utils.toWei(priceInEther.toString(), 'ether'),
        durationInSeconds,
        percentage,
        tokenToLong,
      ).send({from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: createLongOption ::", e);
      return false;
    }
  }

  public listOptionForSale = async (tokenId: number) => {
    await this.getOptionContract();
    try {
      console.log(await this.optionContract.methods.putUpOptionForSale(tokenId)
      .send({from: this.account}));
      return true
    } catch (e) {
      console.log("ERROR :: listOptionForSale ::", e);
      return false;
    }

  }

  public buyOption = async (tokenId: number, priceInEther: number) => {
    await this.getOptionContract();
    try {
      await this.optionContract.methods.buyOption(
        tokenId
      ).send({
        from: this.account,
        value: window.web3.utils.toWei(priceInEther.toString(), 'ether')
      });
      return true;
    } catch (e) {
      console.log("ERROR :: buyOption ::", e);
      return false;
    }
  }

  //Protoco; fee is the fee in percentages
  public calculateProtocolFees(tokenId: number, protocolFee: number) {
    const optionPrice = this.optionContract.methods.itemIdToOptionInfo(tokenId).price;
    return protocolFee * optionPrice;

  }

  public withdrawCash = async (tokenId: number) => {
    await this.getOptionContract();
    try {
      await this.optionContract.methods.withdrawFees(
        tokenId
      ).send({ from: this.account});
      return true;
    } catch (e) {
      console.log("ERROR :: withdrawCash ::", e);
      return false;
    }
  }

  public exerciseOption = async (tokenId: number) => {
    try {
      await this.optionContract.methods.exerciseOption(tokenId).send({ from: this.account });
      return true;
    } catch (e) {
      console.log("ERROR: exerciseOption ::", e)
      return false;
    }

  }

  public getAllListings = async () => {
    await this.getOptionContract();
    try {
      const tokenIds: any[] = await this.optionContract.methods.getAllItemIds().call();
      console.log(this.optionContract.methods.getAllItemIds().call());
      const allListings: OptionInfo[] = await Promise.all(tokenIds.map(this.getOptionListingById));
      return allListings
    } catch (e) {
      console.log("ERROR :: getAllListings ::", e);
      return []
    }
  }



  public getListingsForSale = async () => {
    await this.getOptionContract();
    try {
      const allListings: OptionInfo[] = await this.getAllListings();
      const availableListings: OptionInfo[] = allListings.filter(listing => listing.forSale);
      return availableListings
    } catch (e) {
      console.log("ERROR :: getListingsForSale ::", e);
      return []
    }
  }

  public returnToOwner = async (tokenId: number) => {
    await this.getOptionContract();
    this.optionContract.methods.returnToOriginalOwner(tokenId).send( {from: this.account} );
  }

  public getOptionListingsByOwner = async (ownerAddress: string) => {
    await this.getOptionContract();
    if (ownerAddress == "") {
      ownerAddress = this.account;
    }
    try {
      const allListings:OptionInfo[] = await this.getAllListings();
      const ownedListings: OptionInfo[] = allListings.filter(listing => listing.currentOwner?.toLowerCase() == ownerAddress.toLowerCase())
      return ownedListings
    } catch (e) {
      console.log("ERROR :: getOptionListingsByOwner ::", e);
      return []
    }
  }

  public getOptionListingById = async (tokenId: number) => {
    await this.getOptionContract();
    try {
      const result = await this.optionContract.methods.itemIdToOptionInfo(tokenId).call({ from: this.account });
      let makeOptionInfo = async (listing: any) => {
        let pairing: ERC20Token[] = await this.getPairing(listing.tokenId);
        let position: Position = await this.getPosition(listing.tokenId, pairing);
        return {
          tokenId: listing.tokenId,
          premium: window.web3.utils.fromWei(listing.premium.toString(), 'ether'),
          currentOwner: listing.currentOwner,
          costToExercise: listing.costToExercise,
          longToken: pairing.filter((token) => token.address == listing.tokenLong)[0],
          paymentToken: pairing.filter((token) => token.address == listing.paymentToken)[0],
          expiryDate: listing.expiryDate == 0 ? null : new Date(listing.expiryDate*1000),
          optionPayout: listing.optionPayout,
          amountToReturn: listing.amountToReturn,
          forSale: listing.forSale,
          pairing: pairing,
          position: position,
          pairingIndex: listing.paymentToken == pairing[0].address ? 0 : 1
        } as OptionInfo
      }
      return await makeOptionInfo(result)
    } catch (e) {
      console.log("ERROR :: getOptionListingById ::", e);
      return {} as OptionInfo
    }
  }

  public getNFTSVG = async (tokenId: number) => {
    await this.getNFTMinterContract();
    return await this.NFTMinterContract.methods.tokenURI(tokenId).call()
  }

  public restrictedWithdraw = async () => {
    await this.getOptionContract();
    await this.optionContract.methods.withdraw().send({ from: this.account });
    return true;
  }



}
