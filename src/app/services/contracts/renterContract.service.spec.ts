import { TestBed } from '@angular/core/testing';

import { RenterContractService } from './renterContract.service';

describe('ContractService', () => {
  let service: RenterContractService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RenterContractService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
