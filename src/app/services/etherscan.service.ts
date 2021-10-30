import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {map} from 'rxjs/operators'


@Injectable({
  providedIn: 'root'
})
export class EtherscanService {
  apiKey = "YEWZRGA3ZW87XVTUVYQ16RIISIT56M9QZ8";
  getEthPriceAPI = "https://api.etherscan.io/api?module=stats&action=ethprice&apikey="

  constructor(private http: HttpClient) { }

  getEthPrice() {
    return this.http.get("http://api.etherscan.io/api?module=stats&action=ethprice&apikey=YEWZRGA3ZW87XVTUVYQ16RIISIT56M9QZ8")
    .pipe(
      map((res: any) => res.ethusd)
    )
  }
}
