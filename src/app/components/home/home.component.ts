import { Component, OnInit } from '@angular/core';
import { RenterContractService } from 'src/app/services/contracts/renterContract.service';
import { SalesContractService } from 'src/app/services/contracts/salesContract.service';
import { DomSanitizer } from '@angular/platform-browser';
import graphAPI, { graphAPIURL } from 'src/data_handling/api';
import { AuctionContractService } from 'src/app/services/contracts/auctionContract.service';
import { SwapperContractService } from 'src/app/services/contracts/swapContract.service';
import { OptionContractService } from 'src/app/services/contracts/optionContract.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  manager: any;
  players: any;
  balance: any;
  amountToEnter: number = 0;
  status: string = "";
  nftSvg: any;
  graphAPI: any;

  constructor( 
    private renterContractService: RenterContractService,
    private salesContractService: SalesContractService,
    private auctionContractService: AuctionContractService,
    private optionContractService: OptionContractService,
    private swapContractService: SwapperContractService,
    private domSanitizer: DomSanitizer
  ) { }

  ngOnInit(): void {    
    this.graphAPI = new graphAPI(graphAPIURL);
    this.refresh();
    
  }

  async refresh() {
    // let pooladdr = "0xc2e9f25be6257c210d7adf0d4cd6e3e881ba25f8";
    // let t1 = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
    // let t2 = "0xc778417E063141139Fce010982780140Aa0cD5Ab";
    // console.log("TickRange", await this.graphAPI.getTickRangeInfo('0xc2e9f25be6257c210d7adf0d4cd6e3e881ba25f8', 308160, 309720))
    // console.log("PoolInfo", await this.graphAPI.getPoolInfo('0xc2e9f25be6257c210d7adf0d4cd6e3e881ba25f8')) 
    // console.log("getSwapsLast1Day", await this.graphAPI.getSwapsFromLastXDays(pooladdr, 2, (new Date()).getTime() / 1000))
    // console.log("getFeeTierDistribution", await this.graphAPI.getFeeTierDistribution(t1, t2))
    // console.log(await this.auctionContractService.createNewAuction(8258, 0.001, 120));
    // console.log(await this.auctionContractService.getAllListings());
    // console.log(await this.auctionContractService.bid(8258, 0.0011));
    // console.log(await this.auctionContractService.sendPositionToHighestBidder(8258));
    // console.log(await this.auctionContractService.getAllListings());
    // console.log(await this.auctionContractService.returnAssetToOwner(8258));
    // console.log(await this.auctionContractService.getAllListings());

    // console.log(await this.swapContractService.createNewSwap(8302,120));
    // console.log(await this.swapContractService.getAllListings());
    // console.log(await this.swapContractService.createNewSwap(8303,120));
    // console.log(await this.swapContractService.getAllListings());
    // console.log(await this.swapContractService.makeSwapOffer(8302, 8303));
    // console.log(await this.swapContractService.acceptSwapOffer(8302, 8303));
    // console.log(await this.swapContractService.getAllListings());
    // console.log(await this.swapContractService.withdrawCash(8303));
    // console.log(await this.swapContractService.getAllListings());
    // console.log(await this.swapContractService.returnSwapToOwner(8302));
    // console.log(await this.swapContractService.getAllListings());
    // console.log(await this.swapContractService.getAllListings());


    // console.log(await this.swapContractService.returnSwapToOwner(8277));

    // console.log(await this.optionContractService.getAllListings());
    // console.log(await this.optionContractService.createNewLongOption(9206,0.0001,"0xc7AD46e0b8a400Bb3C915120d284AafbA8fc4735", 600, 10));
    // console.log(await this.optionContractService.getAllListings());

    // console.log(await this.optionContractService.buyOption(9206, 0.0001));
    // console.log(await this.optionContractService.getAllListings());
    // console.log(await this.optionContractService.exerciseOption(9206));
    // console.log(await this.optionContractService.getAllListings());
    // console.log(this.optionContractService.returnToOwner(9206));




    // console.log(await this.salesContractService.createNewSellOffer(8302, 0.001));
    // console.log(await this.salesContractService.getAllListings());
    // // console.log(await this.salesContractService.deleteSale(7812));
    // console.log(await this.salesContractService.getAllListings());
    // console.log(await this.salesContractService.buy(8161, 0.001));
    // console.log(await this.optionContractService.createNewLongOption(8559,0.0001,"0xc7AD46e0b8a400Bb3C915120d284AafbA8fc4735", 180));
    // console.log(await this.optionContractService.getAllListings());
    // // console.log(await this.optionContractService.listOptionForSale(8559));
  }

  async collectFees() {
    console.log(await this.renterContractService.restrictedWithdraw());
    console.log(await this.salesContractService.restrictedWithdraw());
  }
}
