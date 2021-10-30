export interface ERC20Token {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
}

export interface Position {
    tickLower: number;
    tickUpper: number;
    liquidity: number;
    fee: number;
    feeGrowth: number[],
    tokensOwed: number[],
    tokensDeposited: number[],
    pool: string,
    priceRange: PriceRange[],
    rangeToShow: number; //whether priceRange[0] or priceRange[1] is more readable
}

export interface PriceRange {
    lower: number;
    upper: number;
}

export enum ListingTypes {
    Rental = "RENTAL",
    Sale = "SALE",
    Auction = "AUCTION", 
    Option = "OPTION",
    Swap = "SWAP",
    Null = "NULL"
  }
  

export interface ListingInfo {
    tokenId: number;
    seller: string;
    buyer: string | null;
    priceInEther: number;
    pairing: ERC20Token[];
    position: Position;
}

export interface RentInfo extends ListingInfo {
    durationInSeconds: number; //in seconds
    expiryDate: Date | null;
}

export interface AuctionInfo extends ListingInfo {
    highestBidder: string | null;
    minBid: number;
    durationInSeconds: number; //in seconds
    expiryDate: Date | null;
}

export interface OptionInfo {
    tokenId: number;
    premium: number; //in Eth
    currentOwner: string;
    costToExercise: number; //in paymentToken
    optionPayout: number; //in tokenLong
    amountToReturn: number; //in paymentToken
    longToken: ERC20Token;
    forSale: boolean;
    paymentToken: ERC20Token;
    expiryDate: Date | null;
    pairing: ERC20Token[];
    position: Position;
    pairingIndex: number;
}

export interface SwapInfo extends ListingInfo {
}


