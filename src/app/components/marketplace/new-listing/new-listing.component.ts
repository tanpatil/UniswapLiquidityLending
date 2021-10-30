import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ListingTypes } from 'src/app/models/interfaces';
import { OptionContractService } from 'src/app/services/contracts/optionContract.service';
import { RenterContractService } from 'src/app/services/contracts/renterContract.service';
import { SalesContractService } from 'src/app/services/contracts/salesContract.service';

@Component({
  selector: 'app-new-listing',
  templateUrl: './new-listing.component.html',
  styleUrls: ['./new-listing.component.css']
})
export class NewListingComponent implements OnInit {
  error: boolean = false;
  postError: boolean = false;
  loading: boolean = false;
  form: any;
  listingType: ListingTypes = ListingTypes.Rental;
  tokenId = new FormControl('', [Validators.required]);
  priceInEther = new FormControl('', [Validators.required, Validators.pattern("^([0-9]+\.?[0-9]*|\.[0-9]+)$")]);
  duration = new FormControl('', [Validators.pattern("^[0-9]*$")]);
  durationUnits = new FormControl('d', [Validators.required]);
  percentage = new FormControl('100', [Validators.pattern("^[0-9]*$"), Validators.required]);
  tokenAddress = new FormControl('', [Validators.required]);
  durationMultiplier: any;
  //s = seconds, m = minutes, h = hours, d = days, w = weeks

  constructor(private renterContractService: RenterContractService,
    private salesContractService: SalesContractService,
    private optionContractService: OptionContractService
    ) {
  }

  ngOnInit(): void {
    this.durationMultiplier = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400,
      'w': 604800
    }
    this.form = new FormGroup({
      tokenId: this.tokenId,
      priceInEther: this.priceInEther,
      duration: this.duration,
      durationUnits: this.durationUnits
    })
    // console.log(await this.renterContractService.createNewRental(7597, .5, 100000, poolAddr));
  }

  isRental() {
    return this.listingType == ListingTypes.Rental;
  }

  isSale() {
    return this.listingType == ListingTypes.Sale;
  }

  isOption() {
    return this.listingType == ListingTypes.Option;
  }

  getListingType(i: number) {
    return i == 0 ? ListingTypes.Rental : i == 1 ? ListingTypes.Sale : i == 2 ? ListingTypes.Option : ListingTypes.Rental;
  }

  submitForm() {
    let submit = async () => {
      this.loading = true;
      let result;
      if (this.isRental()) {
        result = await this.renterContractService.createNewRental(
          this.tokenId.value, 
          parseFloat(this.priceInEther.value), 
          parseInt(this.duration.value) * this.durationMultiplier[this.durationUnits.value]
        );
      } else if (this.isSale()) {
        result = await this.salesContractService.createNewSellOffer(
          this.tokenId.value, 
          parseFloat(this.priceInEther.value)
        );
      } else if (this.isOption()) {
        result = await this.optionContractService.createNewLongOption(
          this.tokenId.value,
          parseFloat(this.priceInEther.value),
          this.tokenAddress.value,
          parseInt(this.duration.value) * this.durationMultiplier[this.durationUnits.value],
          parseInt(this.percentage.value)
        )
      }
      console.log(result);
      this.loading = false;
      if (!result) {
        this.postError = true;
      }
    }
    if ((this.isSale() && this.tokenId.invalid && this.priceInEther.invalid) || (this.isRental() && this.form.invalid) || (this.isOption() && (this.form.invalid || this.tokenAddress.invalid || this.percentage.invalid))) {
      console.log("Form has validation errors");
      console.log(this.isSale() && this.tokenId.invalid && this.priceInEther.invalid)
      console.log((this.isRental() && this.form.invalid))
      console.log(this.isOption() && (this.form.invalid || this.tokenAddress.invalid || this.percentage.invalid))
      this.error = true;
      return
    }
    submit();
  }

}
