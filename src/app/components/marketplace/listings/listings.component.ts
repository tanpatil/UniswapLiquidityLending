import { Component, OnInit } from '@angular/core';
import { RentInfo, OptionInfo, ListingTypes } from 'src/app/models/interfaces';
import { RenterContractService } from 'src/app/services/contracts/renterContract.service';
import { CoingeckoService } from 'src/app/services/coingecko.service';
import { SalesContractService } from 'src/app/services/contracts/salesContract.service';
import { OptionContractService } from 'src/app/services/contracts/optionContract.service';

@Component({
  selector: 'app-listings',
  templateUrl: './listings.component.html',
  styleUrls: ['./listings.component.css']
})
export class ListingsComponent implements OnInit {
  listings: RentInfo[] = [];
  visibleListings: RentInfo[] = [];
  optionListings: OptionInfo[] = [];
  loading: boolean = false;
  showRentals: boolean = true;
  durationMultiplier: any;
  ethPrice: number = 0;
  value = ""
  searchFields = [
    '', '', //token 1 and token 2
    '0.3', //fee
    '', //price in eth
    '', //duration #
    'd', //duration units
    '', //token id
    '=', //range selection: in, above, or below range
    '0', //index of listing.priceRange to use for range calculation 
  ]
  operators = ['<', '<'] //initial values for each operator
  listingType: ListingTypes = ListingTypes.Rental;
  operatorMap = (op: string, x: number, y: number) => {
    if (op == "=") return x == y
    else if (op == "<") return x < y
    else if (op == ">") return x > y
    else return false
  }

  constructor(
    private renterContractService: RenterContractService,
    private salesContractService: SalesContractService,
    private optionContractService: OptionContractService,
    private coinGecko: CoingeckoService
  ) { }

  ngOnInit(): void {
    this.getEthPrice();
    this.loading = true;
    this.getListings();
    this.durationMultiplier = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400,
      'w': 604800
    }
  }

  async getEthPrice() {
    this.ethPrice = await this.coinGecko.getEthPrice();
  }

  switchListings(showRentals: boolean) {
    if (showRentals != this.showRentals) {
      this.showRentals = showRentals;
      this.visibleListings = [];
      this.getListings();
      this.loading = true;
    }
  }

  async getListings() {
    if (this.showRentals) {
      this.listings = await this.renterContractService.getRentalListings();
    } else {
      this.listings = await this.salesContractService.getAllListings();
    }
    this.visibleListings = [...this.listings];
    this.search();
    this.optionListings = await this.optionContractService.getListingsForSale();
    this.loading = false;
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

  search() {
    if (!this.listings.length) return;
    let fields = this.searchFields.map((f: any) => f.trim());
    this.visibleListings = this.listings.filter((listing: RentInfo) => {
      let result = true;
      if (fields[3] != '') {
        result = result && this.operatorMap(this.operators[0], listing.priceInEther, parseFloat(fields[3]));
      }
      if (this.showRentals && fields[4] != '') {
        result = result && this.operatorMap(this.operators[1], listing.durationInSeconds, parseFloat(fields[4])*this.durationMultiplier[fields[5]]);
      }
      return result &&
        listing.pairing[0].symbol.includes(fields[0].toUpperCase()) &&
        listing.pairing[1].symbol.includes(fields[1].toUpperCase()) &&
        listing.position.fee == parseFloat(fields[2]) &&
        listing.tokenId.toString().includes(fields[6])
    });
    console.log(this.visibleListings)
  }

  getType() {
    return ListingTypes.Option;
  }
}
