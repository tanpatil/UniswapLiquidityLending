import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ListingTypes, OptionInfo, RentInfo } from 'src/app/models/interfaces';
import { RenterContractService } from 'src/app/services/contracts/renterContract.service';
import { DomSanitizer } from '@angular/platform-browser';
import { SalesContractService } from 'src/app/services/contracts/salesContract.service';
import { OptionContractService } from 'src/app/services/contracts/optionContract.service';

@Component({
  selector: 'app-listing',
  templateUrl: './listing.component.html',
  styleUrls: ['./listing.component.css']
})
export class ListingComponent implements OnInit {
  @Input() listing: any;
  @Input() isRental: boolean = true;
  @Input() isOption: boolean = false;
  @Input() listingType: ListingTypes = ListingTypes.Rental;
  @Input() ethPrice: number = 0; 
  @Input() isOwner: boolean = false;
  @Input() isRenter: boolean = false;
  @Output() updateEvent = new EventEmitter<boolean>();
  loading: boolean = false;
  durationMultiplier: any;
  nftSvg: any;

  constructor(
    private renterContractService: RenterContractService,
    private optionContractService: OptionContractService,
    private salesContractService: SalesContractService,
    private domSanitizer: DomSanitizer
  ) { }

  ngOnInit(): void {
    this.durationMultiplier = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400,
      'w': 604800
    }
    this.getNFTImg();
  }

  async getNFTImg() {
    let result = await this.renterContractService.getNFTSVG(this.listing.tokenId);
    const json = atob(result.substring(29));
    result = this.domSanitizer.bypassSecurityTrustUrl(JSON.parse(json).image);
    this.nftSvg = result;
  }

  async purchaseListing() {
    this.loading = true;
    if (this.isOption) {
      let result = await this.optionContractService.buyOption(this.listing.tokenId, this.listing.premium);
    } else if (this.isRental) {
      let result = await this.renterContractService.rent(this.listing.tokenId, this.listing.priceInEther);
    } else {
      let result = await this.salesContractService.buy(this.listing.tokenId, this.listing.priceInEther);
    }
    this.loading = false;
    this.updateEvent.emit(true);
  }

  async collectFees() {
    this.loading = true;
    let result = await this.renterContractService.withdrawCash(this.listing.tokenId)
    console.log("collectFees:",this.listing.tokenId,result)
    this.loading = false;
  }

  async removeListing() {
    this.loading = true;
    if (this.isRental) {
      let result = await this.renterContractService.deleteRental(this.listing.tokenId);
    } else {
      let result = await this.salesContractService.deleteSale(this.listing.tokenId);
    }
    this.loading = false;
    this.updateEvent.emit(true);
  }

  async reclaimLiquidity() {
    this.loading = true;
    let result = await this.renterContractService.returnRentalToOwner(this.listing.tokenId);
    console.log("reclaimLiquidity:",this.listing.tokenId,result);
    this.loading = false;
    this.updateEvent.emit(true);
  }

  timedelta(expiry: any) {
    let now = new Date();
    let delta: number = expiry.getTime()/1000 - now.getTime()/1000;
    return this.deltaToString(delta)
  }

  deltaToString(delta: number) {
    delta = parseFloat(delta.toString())
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
    return delta.toFixed(0) + prefix
  }

  getPriceRange(useToShowPrice: boolean, lower: boolean, returnStrikePrice: boolean = false) {
    let p;
    if (returnStrikePrice) {
      p = this.listing.position.priceRange[this.listing.pairingIndex].upper;
    } else {
      let i = useToShowPrice? this.listing.position.rangeToShow : (this.listing.position.rangeToShow - 1)*-1;
      let r = this.listing.position.priceRange[i];
      p = lower ? r.lower : r.upper;
    }
    if (p > 1000000000) { //in the billions
      return (p / 1000000000).toFixed(0) + 'B'
    } else if (p > 1000000) { //in the millions
      return (p / 1000000).toFixed(2) + 'M'
    } else if (p > 1000) {
      return (p / 1000).toFixed(2) + 'k'
    } else if (p > 100) {
      return p.toFixed(2)
    } else if (p < .0001) {
      return "<0.0001"
    } else {
      return p.toFixed(4)
    }
  }

  async exercise() {
    this.loading = true;
    await this.optionContractService.exerciseOption(this.listing.tokenId);
    this.loading = false;
  }

}
