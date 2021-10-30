import { Component, OnInit } from '@angular/core';
import { RentInfo, ListingInfo, OptionInfo} from 'src/app/models/interfaces';
import { RenterContractService } from 'src/app/services/contracts/renterContract.service';
import { SalesContractService } from 'src/app/services/contracts/salesContract.service';
import { OptionContractService } from 'src/app/services/contracts/optionContract.service';
import { CoingeckoService } from 'src/app/services/coingecko.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  ownedRentalListings: RentInfo[] = [];
  ownedOptions: OptionInfo[] = [];
  ownedSalesListings: ListingInfo[] = [];
  loading: boolean = false;
  ethPrice: number = 0;

  rentedListings: RentInfo[] = [];
  ownedRentalloading: boolean = false;
  ownedSalesLoading: boolean = false;
  ownedRentalLoading: boolean = false;
  rentedLoading: boolean = false;
  isOwner: boolean = false;
  durationMultiplier: any;

  constructor(    private renterContractService: RenterContractService,
    private salesContractService: SalesContractService,
    private optionContractService: OptionContractService,
    private priceService: CoingeckoService
  ) { }

  ngOnInit(): void {
    this.ownedRentalLoading = true;
    this.rentedLoading = true;
    this.getOwnedRental();
    // this.getOwnedForSale();
    this.getRented();
    this.getEthPrice();
    this.durationMultiplier = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400,
      'w': 604800
    }
    
  }

  async getEthPrice() {
    this.ethPrice = await this.priceService.getEthPrice();
  }

  async collectMarketplaceFees() {
    console.log(await this.renterContractService.restrictedWithdraw());
  }

  async checkIfOwner() {
    this.isOwner = await this.renterContractService.isOwner();
  }

  async getOwnedRental() {
    this.ownedRentalListings = await this.renterContractService.getRentalListingsByOwner("");
    let selling = await this.salesContractService.getSalesListingsByOwner("");
    this.ownedOptions = await this.optionContractService.getOptionListingsByOwner("");
    console.log("Options",this.ownedOptions)
    this.ownedRentalListings = [...this.ownedRentalListings, ...selling]
    this.ownedRentalLoading = false;
  }

  // async getOwnedForSale() {
  //   this.ownedSalesListings = await this.salesContractService.getSalesListingsByOwner("");
  //   this.ownedSalesLoading = false;
  //   console.log("Owned For Sale:",this.ownedSalesListings)
  // }

  async getRented() {
    this.rentedListings = await this.renterContractService.getRentalListingsByRenter("");
    this.rentedLoading = false;
    console.log("Rented:", this.rentedListings)
  }

  timedelta(expiry: any) {
    let now = new Date();
    let delta: number = expiry.getTime()/1000 - now.getTime()/1000;
    return this.deltaToString(delta)
  }

  deltaToString(delta: number) {
    if (delta < 0) {
      return "Expired"
    }
    let prefix: string = " seconds"
    if (delta > this.durationMultiplier.w) {
      //seconds to minutes
      delta = delta/this.durationMultiplier.w;
      prefix = " weeks"
    }
    if (delta > this.durationMultiplier.d) {
      //minutes to hours
      delta = delta/this.durationMultiplier.d;
      prefix = " days"
    }
    if (delta > this.durationMultiplier.h) {
      delta = delta/this.durationMultiplier.h
      prefix = " hours"
    }
    if (delta > this.durationMultiplier.m) {
      delta = delta/this.durationMultiplier.m
      prefix = " minutes"
    }
    return delta.toFixed(2) + prefix
  }

  async collectRentedFees(tokenId: number) {
    this.loading = true;
    let result = await this.renterContractService.withdrawCash(tokenId)
    console.log("collectFees:",tokenId,result)
    this.loading = false;
  }

  async removeRentalListing(tokenId: number) {
    this.loading = true;
    let result = await this.renterContractService.deleteRental(tokenId);
    console.log("removeListing:",tokenId,result);
    this.loading = false;
  }

  async reclaimRentalLiquidity(tokenId: number) {
    this.loading = true;
    let result = await this.renterContractService.returnRentalToOwner(tokenId);
    console.log("reclaimLiquidity:",tokenId,result);
    this.loading = false;
  }

}
